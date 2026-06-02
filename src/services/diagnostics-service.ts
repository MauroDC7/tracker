/**
 * Centraal verzamelpunt voor alle "werkt het?"-status:
 * - login + email
 * - laatste actieve venster
 * - queue-grootte
 * - laatste sync (success / error)
 *
 * Zowel tray-menu als diagnostics-venster lezen hier uit.
 */

import { EventEmitter } from 'node:events';
import { isMacAccessibilityTrusted } from '../utils/mac-accessibility';

export interface DiagnosticsSnapshot {
  authenticated: boolean;
  email: string | null;
  apiBaseUrl: string;
  loginPath: string;
  activityPath: string;

  lastWindowAppName: string | null;
  lastWindowTitle: string | null;
  lastWindowAt: string | null;

  queueSize: number;
  lastSyncAt: string | null;
  lastSyncOk: boolean | null;
  lastSyncError: string | null;
  lastSyncCount: number;

  trackingEnabled: boolean;

  /** macOS: Toegankelijkheid voor venster-tracking (live check). */
  macAccessibilityGranted: boolean;
}

export class DiagnosticsService extends EventEmitter {
  private snap: DiagnosticsSnapshot;

  constructor(initial: Pick<DiagnosticsSnapshot, 'apiBaseUrl' | 'loginPath' | 'activityPath'>) {
    super();
    this.snap = {
      authenticated: false,
      email: null,
      apiBaseUrl: initial.apiBaseUrl,
      loginPath: initial.loginPath,
      activityPath: initial.activityPath,

      lastWindowAppName: null,
      lastWindowTitle: null,
      lastWindowAt: null,

      queueSize: 0,
      lastSyncAt: null,
      lastSyncOk: null,
      lastSyncError: null,
      lastSyncCount: 0,

      trackingEnabled: true,
      macAccessibilityGranted: true,
    };
  }

  get(): DiagnosticsSnapshot {
    return {
      ...this.snap,
      macAccessibilityGranted: isMacAccessibilityTrusted(),
    };
  }

  private update(partial: Partial<DiagnosticsSnapshot>): void {
    this.snap = { ...this.snap, ...partial };
    this.emit('change', this.snap);
  }

  setAuth(authenticated: boolean, email: string | null): void {
    this.update({ authenticated, email });
  }

  setWindow(app_name: string, window_title: string): void {
    this.update({
      lastWindowAppName: app_name,
      lastWindowTitle: window_title,
      lastWindowAt: new Date().toISOString(),
    });
  }

  setQueueSize(n: number): void {
    if (n !== this.snap.queueSize) this.update({ queueSize: n });
  }

  setSyncSuccess(count: number): void {
    this.update({
      lastSyncAt: new Date().toISOString(),
      lastSyncOk: true,
      lastSyncError: null,
      lastSyncCount: count,
    });
  }

  setSyncError(error: string): void {
    this.update({
      lastSyncAt: new Date().toISOString(),
      lastSyncOk: false,
      lastSyncError: error,
    });
  }

  setTracking(enabled: boolean): void {
    this.update({ trackingEnabled: enabled });
  }
}
