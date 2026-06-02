import { BrowserWindow, app } from 'electron';
import * as path from 'node:path';
import { loadDockIcon } from './tray-icon';

let win: BrowserWindow | null = null;

export function getLoginWindow(): BrowserWindow | null {
  return win;
}

export function closeLoginWindow(): void {
  if (win && !win.isDestroyed()) win.close();
  win = null;
}

/**
 * Minimal bordered window for one-time Sanctum/JWT acquisition.
 */
export function openLoginWindow(): BrowserWindow {
  if (win && !win.isDestroyed()) {
    win.show();
    win.focus();
    return win;
  }

  const preload = path.join(__dirname, '../preload/login.preload.js');
  const html = app.isPackaged
    ? path.join(process.resourcesPath, 'static', 'login.html')
    : path.join(__dirname, '../../static', 'login.html');

  const appIcon = loadDockIcon();
  win = new BrowserWindow({
    width: 440,
    height: 560,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f4f4f5',
    title: 'Timetraq Tracker — Sign in',
    ...(appIcon ? { icon: appIcon } : {}),
    webPreferences: {
      preload,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  void win.loadFile(html);
  win.once('ready-to-show', () => win?.show());
  win.on('closed', () => {
    win = null;
  });
  return win;
}
