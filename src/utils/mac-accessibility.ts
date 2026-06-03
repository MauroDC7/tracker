import { app, shell, systemPreferences } from 'electron';

/** Of macOS Toegankelijkheid is verleend voor dit proces (Electron-main). */
export function isMacAccessibilityTrusted(): boolean {
  if (process.platform !== 'darwin') return true;
  return systemPreferences.isTrustedAccessibilityClient(false);
}

/** Pad naar het echte Unix-binary in de .app (dit moet in Toegankelijkheid staan). */
export function macAppExecutablePath(): string | null {
  if (process.platform !== 'darwin') return null;
  try {
    return app.getPath('exe');
  } catch {
    return process.execPath;
  }
}

export function openMacAccessibilitySettings(): void {
  if (process.platform !== 'darwin') return;
  void shell.openExternal(
    'x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Accessibility',
  );
}

/** Toon het binary in Finder — gebruiker kan dit handmatig toevoegen in Toegankelijkheid. */
export function revealMacExecutableForAccessibility(): void {
  const exe = macAppExecutablePath();
  if (!exe) return;
  shell.showItemInFolder(exe);
  openMacAccessibilitySettings();
}

export function promptMacAccessibilitySettings(): void {
  revealMacExecutableForAccessibility();
}
