import { systemPreferences } from 'electron';

/** Of macOS Toegankelijkheid is verleend (nodig voor active-win / venstertitels). */
export function isMacAccessibilityTrusted(): boolean {
  if (process.platform !== 'darwin') return true;
  return systemPreferences.isTrustedAccessibilityClient(false);
}

/**
 * Opent het macOS-dialoog + Systeeminstellingen.
 * Alleen aanroepen op gebruikersactie — nooit bij elke app-start (veroorzaakt anders een loop).
 */
export function promptMacAccessibilitySettings(): void {
  if (process.platform !== 'darwin') return;
  systemPreferences.isTrustedAccessibilityClient(true);
}
