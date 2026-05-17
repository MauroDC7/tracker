import { openDiagnosticsWindow } from './diagnostics-window';
import { openLoginWindow } from './login-window';

/** Open het hoofdvenster: status als ingelogd, anders login. */
export function showMainWindow(isAuthenticated: boolean): void {
  if (isAuthenticated) {
    openDiagnosticsWindow();
    return;
  }
  openLoginWindow();
}
