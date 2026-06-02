import { BrowserWindow, app } from 'electron';
import * as path from 'node:path';
import { loadDockIcon } from './tray-icon';

let win: BrowserWindow | null = null;

export function getDiagnosticsWindow(): BrowserWindow | null {
  return win;
}

export function openDiagnosticsWindow(): BrowserWindow {
  if (win && !win.isDestroyed()) {
    win.show();
    win.focus();
    return win;
  }

  const preload = path.join(__dirname, '../preload/diagnostics.preload.js');
  const html = app.isPackaged
    ? path.join(process.resourcesPath, 'static', 'diagnostics.html')
    : path.join(__dirname, '../../static', 'diagnostics.html');

  const appIcon = loadDockIcon();
  win = new BrowserWindow({
    width: 540,
    height: 720,
    show: false,
    autoHideMenuBar: true,
    title: 'Timetraq Tracker — Status',
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
