import { Menu, Tray, type NativeImage } from 'electron';
import { loadTrayIcon } from './tray-icon';
import { showMainWindow } from './show-main-window';
import type { DiagnosticsService } from '../services/diagnostics-service';
import {
  isMacAccessibilityTrusted,
  promptMacAccessibilitySettings,
} from '../utils/mac-accessibility';

export interface TrayControllerDeps {
  diagnostics: DiagnosticsService;
  isAuthenticated: () => boolean;
  isTracking: () => boolean;
  setTracking: (v: boolean) => void;
  isOpenAtLogin: () => boolean;
  setOpenAtLogin: (v: boolean) => void;
  openLogin: () => void;
  openDiagnostics: () => void;
  onLogout: () => void;
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
  const icon: NativeImage = loadTrayIcon();

  const tray = new Tray(icon);
  tray.setToolTip('Timmetraq Tracker');

  // Linkerklik: hoofdvenster. Rechtsklik: menu.
  tray.on('click', () => {
    showMainWindow(deps.isAuthenticated());
  });
  tray.on('right-click', () => {
    tray.popUpContextMenu();
  });

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

    const menu = Menu.buildFromTemplate([
      { label: 'Timmetraq Tracker', enabled: false },
      { type: 'separator' },
      { label: statusLabel, enabled: false },
      { label: queueLabel, enabled: false },
      { label: syncLabel, enabled: false },
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
      ...(process.platform === 'darwin' && !isMacAccessibilityTrusted()
        ? [
            {
              label: 'Toegankelijkheid instellen…',
              click: () => promptMacAccessibilitySettings(),
            },
          ]
        : []),
      {
        label: s.authenticated ? 'Opnieuw aanmelden…' : 'Aanmelden…',
        click: () => deps.openLogin(),
      },
      ...(s.authenticated
        ? [{ label: 'Uitloggen', click: () => deps.onLogout() }]
        : []),
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
      `Timmetraq Tracker — ${s.authenticated ? 'ingelogd' : 'niet ingelogd'}, wachtrij ${s.queueSize}`,
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
