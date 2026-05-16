import axios, { type AxiosInstance } from 'axios';
import { env } from '../utils/env';
import { createApiHttpsAgent } from '../utils/tls';
import type { ActivityPayload, LoginCredentials } from '../types';
import { logger } from '../utils/logger';

/**
 * HTTP client for Laravel. Uses Bearer auth; batches activities in one JSON body.
 * Actual retry/backoff lives in SyncService so we can persist queue on hard failures.
 */
export class RemoteApiClient {
  private http: AxiosInstance;

  constructor() {
    const httpsAgent = createApiHttpsAgent(env.remoteApiBaseUrl);
    this.http = axios.create({
      baseURL: env.remoteApiBaseUrl,
      timeout: 45_000,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      ...(httpsAgent ? { httpsAgent } : {}),
    });
  }

  /**
   * Example: POST https://api.officemate.app/api/activity
   * Body: { "activities": [ { ...ActivityPayload } ] }
   */
  async postActivityBatch(
    token: string,
    activities: ActivityPayload[],
  ): Promise<void> {
    const path = env.remoteActivityPath.startsWith('/')
      ? env.remoteActivityPath
      : `/${env.remoteActivityPath}`;
    await this.http.post(path, { activities }, this.authCfg(token));
  }

  /**
   * Example login — adapt field names to your Laravel API contract.
   * Expects JSON containing access_token or token, and optional user id field.
   */
  async login(creds: LoginCredentials): Promise<{ accessToken: string; userId?: number }> {
    const path = env.remoteLoginPath.startsWith('/')
      ? env.remoteLoginPath
      : `/${env.remoteLoginPath}`;
    const email = creds.email.trim().toLowerCase();
    const password = creds.password;
    logger.debug(`Login POST ${env.remoteApiBaseUrl}${path} email=${email}`);

    const { data } = await this.http.post<Record<string, unknown>>(
      path,
      { email, password },
      { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } },
    );
    const accessToken =
      (data['access_token'] as string) ||
      (data['token'] as string) ||
      (data['data'] as { token?: string } | undefined)?.token;
    if (!accessToken) {
      logger.error('Login response missing token fields', Object.keys(data));
      throw new Error('Unexpected login response');
    }
    const userId =
      (data['user_id'] as number | undefined) ||
      (data['user'] as { id?: number } | undefined)?.id;
    return { accessToken, userId };
  }

  private authCfg(token: string) {
    return { headers: { Authorization: `Bearer ${token}` } };
  }
}
