import { SecureAuthStore } from '../storage/secure-auth-store';
import type { AuthState, LoginCredentials } from '../types';
import { RemoteApiClient } from '../api/remote-api-client';
import { logger } from '../utils/logger';

/**
 * Single sign-on for the desktop agent. Token is used only for metadata sync.
 */
export class AuthService {
  private store = new SecureAuthStore();
  private remote = new RemoteApiClient();
  private state: AuthState | null = null;

  constructor() {
    this.state = this.store.load();
  }

  isAuthenticated(): boolean {
    return !!this.state?.accessToken;
  }

  getToken(): string | null {
    return this.state?.accessToken ?? null;
  }

  getUserId(): number | undefined {
    return this.state?.userId;
  }

  getEmail(): string | undefined {
    return this.state?.email;
  }

  async login(creds: LoginCredentials): Promise<void> {
    const res = await this.remote.login(creds);
    this.state = {
      accessToken: res.accessToken,
      userId: res.userId,
      email: creds.email,
    };
    this.store.save(this.state);
    logger.info('Authenticated; token stored with OS encryption when available');
  }

  logout(): void {
    this.state = null;
    this.store.clear();
  }
}
