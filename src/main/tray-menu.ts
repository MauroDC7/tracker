import { Menu, Tray, nativeImage, type NativeImage } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createTrayImage } from './tray-icon';
import type { DiagnosticsService } from '../services/diagnostics-service';

export interface TrayControllerDeps {
  diagnostics: DiagnosticsService;
  isTracking: () => boolean;
  setTracking: (v: boolean) => void;
  isOpenAtLogin: () => boolean;
  setOpenAtLogin: (v: boolean) => void;
  openLogin: () => void;
  openDiagnostics: () => void;
  syncNow: () => void;
  onQuit: () => void | Promise<void>;
}

export interface TrayController {
  tray: Tray;
  refresh: () => void;
}

/**
 * System tray entry point — primary UX when running minimized.
 * Het menu toont live status (ingelogd, queue, laatste sync) zodat
 * de gebruiker direct weet of de tracker werkt.
 */
export function createTray(deps: TrayControllerDeps): TrayController {
  let icon: NativeImage = createTrayImage();
  const devIcon = path.join(__dirname, '../../assets/icon.png');
  if (fs.existsSync(devIcon)) {
    const alt = nativeImage.createFromPath(devIcon);
    if (!alt.isEmpty()) icon = alt;
  }

  const tray = new Tray(icon);
  tray.setToolTip('OfficeMate Tracker');

  const rebuild = () => {
    const s = deps.diagnostics.get();
    const tracking = deps.isTracking();
    const openAtLogin = deps.isOpenAtLogin();

    const statusLabel = s.authenticated
      ? `✓ Ingelogd${s.email ? ' — ' + s.email : ''}`
      : '⚠ Niet ingelogd';

    const syncLabel =
      s.lastSyncOk === null
        ? 'Synchronisatie: nog niet uitgevoerd'
        : s.lastSyncOk
        ? `Synchronisatie: laatst gelukt${s.lastSyncCount ? ' (' + s.lastSyncCount + ')' : ''}`
        : `Synchronisatie: laatst mislukt — ${truncate(s.lastSyncError, 40)}`;

    const queueLabel = `Wachtrij: ${s.queueSize}`;

    const browserLabel = s.lastBrowserDomain
      ? `Tab: ${truncate(s.lastBrowserDomain, 30)}`
      : 'Tab: (extensie nog niet actief)';

    const menu = Menu.buildFromTemplate([
      { label: 'OfficeMate Tracker', enabled: false },
      { type: 'separator' },
      { label: statusLabel, enabled: false },
      { label: queueLabel, enabled: false },
      { label: syncLabel, enabled: false },
      { label: browserLabel, enabled: false },
      { type: 'separator' },
      {
        label: tracking ? 'Tracking pauzeren' : 'Tracking hervatten',
        click: () => {
          deps.setTracking(!tracking);
          rebuild();
        },
      },
      {
        label: 'Nu synchroniseren',
        click: () => deps.syncNow(),
      },
      {
        label: 'Status openen…',
        click: () => deps.openDiagnostics(),
      },
      {
        label: s.authenticated ? 'Opnieuw aanmelden…' : 'Aanmelden…',
        click: () => deps.openLogin(),
      },
      { type: 'separator' },
      {
        label: 'Starten bij aanmelden',
        type: 'checkbox',
        checked: openAtLogin,
        click: (item) => {
          deps.setOpenAtLogin(item.checked);
          rebuild();
        },
      },
      { type: 'separator' },
      {
        label: 'Afsluiten',
        click: () => deps.onQuit(),
      },
    ]);
    tray.setContextMenu(menu);

    tray.setToolTip(
      `OfficeMate Tracker — ${s.authenticated ? 'ingelogd' : 'niet ingelogd'}, wachtrij ${s.queueSize}`,
    );
  };

  // Herbouw zodra diagnostics verandert, en eens per 10s als veiligheidsnet.
  deps.diagnostics.on('change', () => rebuild());
  setInterval(rebuild, 10_000);

  rebuild();
  return { tray, refresh: rebuild };
}

function truncate(s: string | null, max: number): string {
  if (!s) return '';
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
