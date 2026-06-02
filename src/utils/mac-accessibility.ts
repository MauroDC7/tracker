import { shell, systemPreferences } from 'electron';

/** Of macOS Toegankelijkheid is verleend (nodig voor active-win / venstertitels). */
export function isMacAccessibilityTrusted(): boolean {
  if (process.platform !== 'darwin') return true;
  return systemPreferences.isTrustedAccessibilityClient(false);
}

/**
 * Opent Systeeminstellingen → Toegankelijkheid.
 * Gebruik NOOIT isTrustedAccessibilityClient(true) — dat toont steeds opnieuw het systeemdialoog.
 */
export function openMacAccessibilitySettings(): void {
  if (process.platform !== 'darwin') return;
  void shell.openExternal(
    'x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Accessibility',
  );
}

/** Tray-actie: alleen instellingen openen, geen Electron-prompt. */
export function promptMacAccessibilitySettings(): void {
  openMacAccessibilitySettings();
}
