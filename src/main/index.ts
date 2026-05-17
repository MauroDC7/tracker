/**
 * OfficeMate Tracker — main process bootstrap.
 *
 * Architecture (MVP):
 * - Foreground window metadata via `active-win` on a fixed poll interval.
 * - Browser URL/title via local MV3 extension POSTing to loopback HTTP (no native messaging).
 * - Durable disk queue + periodic Axios batches to Laravel (offline-safe).
 * - Auth token in userData with OS encryption when `safeStorage` is available.
 */
import { app, Menu } from 'electron';
import { env } from '../utils/env';
import { logger } from '../utils/logger';
import { ActivityQueue } from '../storage/activity-queue';
import { loadSettings, saveSettings, type TrackerSettings } from '../storage/tracker-settings';
import { AuthService } from '../services/auth-service';
import { BrowserStateService } from '../services/browser-state';
import { LocalBrowserServer } from '../services/local-browser-server';
import { RemoteApiClient } from '../api/remote-api-client';
import { SyncService } from '../services/sync-service';
import { DiagnosticsService } from '../services/diagnostics-service';
import { TrackingCoordinator } from '../trackers/tracking-coordinator';
import { registerIpcAuth, registerIpcDiagnostics } from '../ipc/register-ipc';
import { createTray, type TrayController } from './tray-menu';
import { loadDockIcon } from './tray-icon';
import { openLoginWindow } from './login-window';
import { openDiagnosticsWindow } from './diagnostics-window';
import { showMainWindow } from './show-main-window';
import type { Tray } from 'electron';

export class OfficeMateApp {
  private settings: TrackerSettings = loadSettings();
  private readonly queue = new ActivityQueue();
  private readonly auth = new AuthService();
  private readonly diagnostics = new DiagnosticsService({
    apiBaseUrl: env.remoteApiBaseUrl,
    loginPath: env.remoteLoginPath,
    activityPath: env.remoteActivityPath,
    localPort: env.localBrowserApiPort,
  });
  private readonly browserState = new BrowserStateService();
  private readonly localServer = new LocalBrowserServer(this.browserState);
  private readonly remote = new RemoteApiClient();
  private readonly sync = new SyncService(
    this.queue,
    this.remote,
    () => this.auth.getToken(),
    this.diagnostics,
  );
  private readonly coordinator = new TrackingCoordinator(
    this.queue,
    this.browserState,
    env.activeWindowPollMs,
    () => this.auth.getUserId(),
    () => this.settings.trackingEnabled,
    this.diagnostics,
  );

  private tray: Tray | null = null;
  private trayController: TrayController | null = null;

  async start(): Promise<void> {
    this.browserState.attachDiagnostics(this.diagnostics);
    this.diagnostics.setAuth(this.auth.isAuthenticated(), this.auth.getEmail() ?? null);
    this.diagnostics.setTracking(this.settings.trackingEnabled);
    this.diagnostics.setQueueSize(this.queue.size());

    registerIpcAuth(this.auth, this.diagnostics);
    registerIpcDiagnostics({
      diagnostics: this.diagnostics,
      sync: this.sync,
      auth: this.auth,
      openLogin: () => openLoginWindow(),
      onLogout: () => {
        // Tray label refresh & open login to re-authenticate
        this.trayController?.refresh();
        openLoginWindow();
      },
    });

    await this.localServer.start();
    this.applyOpenAtLogin();
    this.sync.start();
    this.refreshTrackingLoop();

    this.trayController = createTray({
      diagnostics: this.diagnostics,
      isAuthenticated: () => this.auth.isAuthenticated(),
      isTracking: () => this.settings.trackingEnabled,
      setTracking: (v) => this.setTrackingEnabled(v),
      isOpenAtLogin: () => this.settings.openAtLogin,
      setOpenAtLogin: (v) => this.setOpenAtLogin(v),
      openLogin: () => openLoginWindow(),
      openDiagnostics: () => openDiagnosticsWindow(),
      onLogout: () => {
        this.auth.logout();
        this.diagnostics.setAuth(false, null);
        this.trayController?.refresh();
        openLoginWindow();
      },
      syncNow: () => void this.sync.flushOnce(),
      onQuit: () => {
        app.quit();
      },
    });
    this.tray = this.trayController.tray;

    if (!this.auth.isAuthenticated()) {
      openLoginWindow();
    } else {
      logger.info(
        'Ingelogd — klik op Electron in het dock (of menubalk-icoon) om Status te openen',
      );
    }

    logger.info(
      `OfficeMate Tracker started — API ${env.remoteApiBaseUrl}${env.remoteLoginPath}`,
    );
  }

  /** Dock-klik / Opnieuw activeren: toon status of login. */
  focusMainWindow(): void {
    showMainWindow(this.auth.isAuthenticated());
  }

  async shutdown(): Promise<void> {
    this.coordinator.flushOpenSegment();
    this.coordinator.stop();
    this.sync.stop();
    await this.sync.flushQueueBestEffort();
    await this.localServer.stop();
  }

  private refreshTrackingLoop(): void {
    if (this.settings.trackingEnabled) {
      this.coordinator.start();
    } else {
      this.coordinator.stop();
    }
  }

  private setTrackingEnabled(v: boolean): void {
    if (v === this.settings.trackingEnabled) return;
    if (!v) {
      this.coordinator.flushOpenSegment();
      this.coordinator.stop();
    }
    this.settings.trackingEnabled = v;
    saveSettings(this.settings);
    this.diagnostics.setTracking(v);
    this.refreshTrackingLoop();
  }

  private setOpenAtLogin(v: boolean): void {
    this.settings.openAtLogin = v;
    saveSettings(this.settings);
    this.applyOpenAtLogin();
  }

  private applyOpenAtLogin(): void {
    app.setLoginItemSettings({
      openAtLogin: this.settings.openAtLogin,
      path: process.execPath,
      args: app.isPackaged ? [] : [app.getAppPath()],
    });
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  let core: OfficeMateApp | null = null;
  let isQuitting = false;

  app.on('second-instance', () => {
    core?.focusMainWindow();
  });

  app.on('activate', () => {
    core?.focusMainWindow();
  });

  /** Without a listener, Windows/Linux quit when the last window (e.g. login) closes. */
  app.on('window-all-closed', () => {
    /* tray-only */
  });

  app.whenReady().then(async () => {
    if (process.platform === 'darwin') {
      // Dock zichtbaar houden zodat de app vindbaar is (menubalk-icoon kan onzichtbaar zijn).
      const dockIcon = loadDockIcon();
      if (dockIcon) app.dock?.setIcon(dockIcon);

      const dockMenu = Menu.buildFromTemplate([
        {
          label: 'Status openen',
          click: () => core?.focusMainWindow(),
        },
        {
          label: 'Aanmelden…',
          click: () => openLoginWindow(),
        },
        { type: 'separator' },
        { label: 'Afsluiten', click: () => app.quit() },
      ]);
      app.dock?.setMenu(dockMenu);

      Menu.setApplicationMenu(
        Menu.buildFromTemplate([
          {
            label: 'OfficeMate Tracker',
            submenu: [
              {
                label: 'Status openen',
                accelerator: 'CmdOrCtrl+Shift+S',
                click: () => core?.focusMainWindow(),
              },
              {
                label: 'Aanmelden…',
                click: () => openLoginWindow(),
              },
              { type: 'separator' },
              { role: 'quit', label: 'Afsluiten' },
            ],
          },
          { role: 'editMenu' },
        ]),
      );

      // macOS vereist expliciete Accessibility-toestemming voor active-win.
      // systemPreferences is beschikbaar maar de check zelf is async via
      // een native prompt — we loggen alleen een waarschuwing zodat de
      // gebruiker weet wat te doen als venstertitels leeg blijven.
      const { systemPreferences } = await import('electron');
      const trusted = systemPreferences.isTrustedAccessibilityClient(false);
      if (!trusted) {
        logger.warn(
          'macOS: Accessibility-toegang niet verleend. ' +
          'Ga naar Systeeminstellingen → Privacy & Beveiliging → Toegankelijkheid ' +
          'en voeg OfficeMate Tracker toe. Venster-tracking werkt mogelijk niet volledig.',
        );
        // Vraag de toestemming aan — macOS toont een systeemdialoog
        systemPreferences.isTrustedAccessibilityClient(true);
      }
    }
    core = new OfficeMateApp();
    await core.start();
  });

  app.on('before-quit', (e) => {
    if (isQuitting || !core) return;
    e.preventDefault();
    isQuitting = true;
    void core
      .shutdown()
      .catch((err) => logger.error('Shutdown error', err))
      .finally(() => {
        core = null;
        app.exit(0);
      });
  });
}
