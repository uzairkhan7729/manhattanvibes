import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { join } from 'node:path';

import { openDb, type Db } from './db';
import { registerSyncIpc } from './sync';

let mainWindow: BrowserWindow | null = null;
let db: Db | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 820,
    show: false,
    autoHideMenuBar: true,
    title: 'Manhattan Vibes POS',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
    },
  });

  mainWindow.on('ready-to-show', () => mainWindow?.show());
  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  db = openDb();
  registerSyncIpc(ipcMain, db);
  registerStateIpc(ipcMain, db);

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Boot failed:', err);
  app.exit(1);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  db?.close();
});

function registerStateIpc(ipc: typeof ipcMain, database: Db): void {
  ipc.handle('kv:get', (_e, key: string): string | null => {
    const row = database.prepare('SELECT value FROM kv WHERE key = ?').get(key) as { value?: string } | undefined;
    return row?.value ?? null;
  });
  ipc.handle('kv:set', (_e, key: string, value: string): void => {
    database.prepare('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
  });
  ipc.handle('kv:del', (_e, key: string): void => {
    database.prepare('DELETE FROM kv WHERE key = ?').run(key);
  });
}
