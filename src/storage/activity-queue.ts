import * as fs from 'node:fs';
import * as path from 'node:path';
import { queueFilePath } from './paths';
import type { ActivityPayload } from '../types';
import { logger } from '../utils/logger';

/**
 * Durable FIFO queue on disk so failed syncs survive restarts and offline periods.
 * Append-only style: read all, mutate, write — acceptable for MVP batch sizes.
 */
export class ActivityQueue {
  private path = queueFilePath();

  private readAll(): ActivityPayload[] {
    try {
      if (!fs.existsSync(this.path)) return [];
      const raw = fs.readFileSync(this.path, 'utf8');
      const data = JSON.parse(raw) as ActivityPayload[];
      return Array.isArray(data) ? data : [];
    } catch (e) {
      logger.error('Corrupt queue file; resetting', e);
      return [];
    }
  }

  private writeAll(items: ActivityPayload[]): void {
    const dir = path.dirname(this.path);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.path, JSON.stringify(items, null, 0), 'utf8');
  }

  enqueue(item: ActivityPayload): void {
    const q = this.readAll();
    q.push(item);
    this.writeAll(q);
  }

  /** Returns up to `max` items and removes them from disk only after caller succeeds. */
  peek(max: number): ActivityPayload[] {
    return this.readAll().slice(0, max);
  }

  /** Remove first `count` items after successful remote sync. */
  dequeue(count: number): void {
    const q = this.readAll();
    this.writeAll(q.slice(count));
  }

  size(): number {
    return this.readAll().length;
  }
}
