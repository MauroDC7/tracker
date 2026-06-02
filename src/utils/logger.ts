import { env } from './env';

type Level = 'debug' | 'info' | 'warn' | 'error';

const order: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function minLevel(): number {
  return order[(env.logLevel as Level) in order ? (env.logLevel as Level) : 'info'];
}

function log(level: Level, ...args: unknown[]): void {
  if (order[level] < minLevel()) return;
  const ts = new Date().toISOString();
  const line = `[${ts}] [Timmetraq Tracker] [${level.toUpperCase()}]`;
  if (level === 'error') console.error(line, ...args);
  else if (level === 'warn') console.warn(line, ...args);
  else console.log(line, ...args);
}

export const logger = {
  debug: (...a: unknown[]) => log('debug', ...a),
  info: (...a: unknown[]) => log('info', ...a),
  warn: (...a: unknown[]) => log('warn', ...a),
  error: (...a: unknown[]) => log('error', ...a),
};
