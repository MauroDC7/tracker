import { ipcMain, BrowserWindow } from 'electron';
import axios from 'axios';
import type { AuthService } from '../services/auth-service';
import type { LoginCredentials } from '../types';
import type { DiagnosticsService } from '../services/diagnostics-service';
import type { SyncService } from '../services/sync-service';
import { logger } from '../utils/logger';

/**
 * Registers preload-invoked IPC channels. Kept small so renderer/preload surface stays auditable.
 */
export function registerIpcAuth(
  auth: AuthService,
  diagnostics: DiagnosticsService,
): void {
  ipcMain.removeHandler('auth:login');
  ipcMain.handle('auth:login', async (_event, creds: LoginCredentials) => {
    try {
      await auth.login(creds);
      diagnostics.setAuth(true, auth.getEmail() ?? null);
      return { ok: true as const };
    } catch (e: unknown) {
      const msg = formatLoginError(e);
      logger.warn('Login failed', msg);
      return { ok: false as const, error: msg };
    }
  });
}

export interface DiagIpcDeps {
  diagnostics: DiagnosticsService;
  sync: SyncService;
  auth: AuthService;
  openLogin: () => void;
  onLogout: () => void;
}

export function registerIpcDiagnostics(deps: DiagIpcDeps): void {
  const channels = ['diag:get', 'diag:syncNow', 'diag:openLogin', 'diag:logout'];
  for (const c of channels) ipcMain.removeHandler(c);

  ipcMain.handle('diag:get', () => deps.diagnostics.get());
  ipcMain.handle('diag:syncNow', async () => {
    await deps.sync.flushOnce();
    return deps.diagnostics.get();
  });
  ipcMain.handle('diag:openLogin', () => {
    deps.openLogin();
  });
  ipcMain.handle('diag:logout', () => {
    deps.auth.logout();
    deps.diagnostics.setAuth(false, null);
    deps.onLogout();
  });

  deps.diagnostics.on('change', (snap) => {
    for (const w of BrowserWindow.getAllWindows()) {
      if (w.isDestroyed()) continue;
      w.webContents.send('diag:update', snap);
    }
  });
}

function formatLoginError(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const status = e.response?.status;
    const data = e.response?.data as { message?: string; errors?: Record<string, string[]> } | undefined;
    const apiMsg = data?.message;
    const firstFieldErr = data?.errors ? Object.values(data.errors).flat()[0] : undefined;
    const code = e.code;

    if (code === 'ECONNREFUSED') return 'Verbinding geweigerd — API niet bereikbaar.';
    if (code === 'ETIMEDOUT' || code === 'ECONNABORTED') return 'Time-out richting API.';
    if (code === 'ENOTFOUND') return 'Hostnaam niet gevonden. Klopt REMOTE_API_BASE_URL?';
    if (code && code.startsWith('CERT')) return 'TLS-fout: certificaat niet vertrouwd (Herd CA).';
    if (code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || code === 'SELF_SIGNED_CERT_IN_CHAIN') {
      return 'TLS-fout: certificaat niet vertrouwd (Herd CA).';
    }

    if (status === 401 || status === 403) {
      return (
        apiMsg ||
        'Onjuiste e-mail of wachtwoord. Gebruik hetzelfde account als op officemate.test (of registreer eerst).'
      );
    }
    if (status === 404) return 'Login-endpoint niet gevonden (404). Klopt REMOTE_LOGIN_PATH?';
    if (status === 419) return 'CSRF-fout (419). Endpoint zit waarschijnlijk achter web-middleware i.p.v. API.';
    if (status === 422) return firstFieldErr || apiMsg || 'Validatiefout op de API.';
    if (status && status >= 500) return apiMsg || `Serverfout (${status}).`;
    if (apiMsg) return apiMsg;
    return e.message || 'Aanmelden mislukt.';
  }
  if (e instanceof Error && e.message === 'Unexpected login response') {
    return 'API antwoordde zonder access_token/token-veld.';
  }
  if (e instanceof Error) return e.message;
  return 'Aanmelden mislukt.';
}
