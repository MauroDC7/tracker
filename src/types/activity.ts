/**
 * Activity DTO — metadata only. No screenshots, keystrokes, or page body.
 * Aligns with Laravel ingestion: POST /api/activity (batch wrapper in remote client).
 */
export interface ActivityPayload {
  /** Set by server from token; optional client echo for offline reconciliation */
  user_id?: number;
  app_name: string;
  window_title: string;
  browser_url: string | null;
  browser_domain: string | null;
  browser_tab_title: string | null;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
}

export interface BrowserEventDto {
  url: string;
  title: string;
  domain: string;
  is_incognito: boolean;
  /** ISO timestamp when extension observed the change */
  observed_at: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthState {
  accessToken: string;
  userId?: number;
  email?: string;
}
