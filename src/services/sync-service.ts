import { RemoteApiClient } from '../api/remote-api-client';
import { ActivityQueue } from '../storage/activity-queue';
import type { DiagnosticsService } from './diagnostics-service';
import { env } from '../utils/env';
import { logger } from '../utils/logger';

/**
 * Pulls durable queue batches and POSTs to Laravel with exponential backoff on
 * transient errors. Successful batches are dequeued only after 2xx response.
 */
export class SyncService {
  private timer: NodeJS.Timeout | null = null;
  private failures = 0;

  constructor(
    private queue: ActivityQueue,
    private remote: RemoteApiClient,
    private getToken: () => string | null,
    private diagnostics: DiagnosticsService | null = null,
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), env.syncIntervalMs);
    void this.tick();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick(): Promise<void> {
    const token = this.getToken();
    this.diagnostics?.setQueueSize(this.queue.size());
    if (!token) return;
    const batchSize = env.syncBatchSize;
    let safety = 0;
    while (safety++ < 100) {
      const batch = this.queue.peek(batchSize);
      if (batch.length === 0) return;
      try {
        await this.remote.postActivityBatch(token, batch);
        this.queue.dequeue(batch.length);
        this.failures = 0;
        this.diagnostics?.setSyncSuccess(batch.length);
        this.diagnostics?.setQueueSize(this.queue.size());
        logger.debug(`Synced ${batch.length} activities`);
      } catch (e) {
        const decision = classifyError(e);
        const msg = formatErr(e);
        this.diagnostics?.setSyncError(msg);

        if (decision === 'drop') {
          // Server vond de payload ongeldig (422/400/413). Retry helpt niet —
          // gooi de batch weg zodat de wachtrij niet eeuwig vastloopt.
          this.queue.dequeue(batch.length);
          this.diagnostics?.setQueueSize(this.queue.size());
          logger.warn(`Sync drop: ${batch.length} activities verworpen door server (${msg})`);
          this.failures = 0;
          continue;
        }

        if (decision === 'auth') {
          logger.warn(`Sync gestopt: token ongeldig of verlopen (${msg}). Log opnieuw in.`);
          return;
        }

        this.failures++;
        const waitMs = Math.min(60_000, 2000 * 2 ** Math.min(this.failures, 5));
        logger.warn(`Sync failed (attempt ${this.failures}); retry in ${waitMs}ms`, msg);
        await sleep(waitMs);
        break;
      }
    }
  }

  /** Force a sync pass (e.g. before quit). */
  async flushOnce(): Promise<void> {
    await this.tick();
  }

  /**
   * On shutdown, try to drain the queue without long backoff sleeps between batches.
   * Remaining items stay on disk if the network is down.
   */
  async flushQueueBestEffort(): Promise<void> {
    const token = this.getToken();
    if (!token) return;
    for (let i = 0; i < 500; i++) {
      const batch = this.queue.peek(env.syncBatchSize);
      if (batch.length === 0) return;
      try {
        await this.remote.postActivityBatch(token, batch);
        this.queue.dequeue(batch.length);
        this.failures = 0;
      } catch (e) {
        const decision = classifyError(e);
        if (decision === 'drop') {
          this.queue.dequeue(batch.length);
          logger.warn(`Shutdown flush: ${batch.length} activities verworpen (${formatErr(e)})`);
          continue;
        }
        logger.warn('Shutdown flush aborted with items still queued', e);
        return;
      }
    }
  }
}

type ErrorDecision = 'drop' | 'auth' | 'retry';

function classifyError(e: unknown): ErrorDecision {
  const err = e as { response?: { status?: number }; code?: string };
  const status = err?.response?.status;
  if (status === 401 || status === 403) return 'auth';
  if (status === 400 || status === 413 || status === 422) return 'drop';
  return 'retry';
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function formatErr(e: unknown): string {
  const err = e as { response?: { status?: number; data?: { message?: string } }; code?: string; message?: string };
  if (err?.response?.status) {
    const m = err.response.data?.message;
    return `HTTP ${err.response.status}${m ? ' — ' + m : ''}`;
  }
  return err?.code || err?.message || String(e);
}
