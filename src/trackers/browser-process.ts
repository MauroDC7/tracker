/**
 * Heuristic: map foreground process to "is a web browser" for attaching extension metadata.
 * macOS/Linux names differ — extend this map as ports are validated.
 */
export function isLikelyBrowserProcess(appName: string): boolean {
  const n = appName.toLowerCase();
  return (
    n.includes('chrome') ||
    n.includes('msedge') ||
    n.includes('edge') ||
    n.includes('brave') ||
    n.includes('opera') ||
    n.includes('vivaldi') ||
    n.includes('firefox') ||
    n.includes('arc') ||
    n.includes('chromium')
  );
}
