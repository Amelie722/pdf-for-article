// 앱 시작점: 창 생성, 데이터베이스 열기, 기능 모듈 등록, "PDF로 열기" 처리.
import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Channels } from '../shared/types';
import { Db } from './db';
import { modules } from './modules';
import type { ModuleContext } from './modules/types';
import { checkForUpdatesManually, setupUpdater } from './updater';

// 데이터 폴더를 영문 이름으로 고정 (Windows: %APPDATA%\\PaperReader)
app.setPath('userData', join(app.getPath('appData'), 'PaperReader'));

let win: BrowserWindow | null = null;
let db: Db | null = null;
let pendingPath: string | null = findPdfArg(process.argv);

/** 명령줄 인자에서 PDF 경로를 찾는다. 탐색기에서 PDF를 더블클릭하면 이렇게 전달된다. */
function findPdfArg(argv: string[]): string | null {
  for (const arg of argv.slice(1).reverse()) {
    if (arg.toLowerCase().endsWith('.pdf')) {
      const p = resolve(arg);
      if (existsSync(p)) return p;
    }
  }
  return null;
}

function sendOpenPath(path: string): void {
  if (!win) {
    pendingPath = path;
    return;
  }
  if (win.isMinimized()) win.restore();
  win.focus();
  win.webContents.send(Channels.openPathEvent, path);
}

// 이미 실행 중이면 새 창을 띄우지 않고 기존 창에서 연다.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    const p = findPdfArg(argv);
    if (p) sendOpenPath(p);
    else if (win) win.focus();
  });
  app.on('open-file', (e, path) => {
    e.preventDefault();
    sendOpenPath(path);
  });
  app.whenReady().then(start);
}

function buildMenu(): void {
  const send = (cmd: string) => () => win?.webContents.send('menu:command', cmd);
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: '파일',
        submenu: [
          { label: 'PDF 열기…', accelerator: 'CmdOrCtrl+O', click: send('open') },
          { label: '홈', accelerator: 'CmdOrCtrl+H', click: send('home') },
          { type: 'separator' },
          { label: '종료', role: 'quit' },
        ],
      },
      {
        label: '보기',
        submenu: [
          { label: '확대', accelerator: 'CmdOrCtrl+=', click: send('zoom-in') },
          { label: '축소', accelerator: 'CmdOrCtrl+-', click: send('zoom-out') },
          { label: '폭 맞춤', accelerator: 'CmdOrCtrl+0', click: send('zoom-fit') },
          { type: 'separator' },
          { label: '하이라이트·메모 모아보기', accelerator: 'CmdOrCtrl+Shift+A', click: send('collection') },
          { type: 'separator' },
          { label: '개발자 도구', role: 'toggleDevTools' },
        ],
      },
      {
        label: '도움말',
        submenu: [
          { label: '업데이트 확인', click: () => checkForUpdatesManually() },
          { label: `버전 ${app.getVersion()}`, enabled: false },
        ],
      },
    ]),
  );
}

async function start(): Promise<void> {
  db = await Db.open(join(app.getPath('userData'), 'library.sqlite'));

  const ctx: ModuleContext = {
    db,
    getWindow: () => win,
    handle: (channel, fn) => ipcMain.handle(channel, fn),
  };
  for (const m of modules) await m.setup(ctx);

  ipcMain.handle(Channels.initialPath, () => {
    const p = pendingPath;
    pendingPath = null;
    return p;
  });

  buildMenu();

  win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: '논문 리더',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.on('closed', () => (win = null));
  await win.loadFile(join(__dirname, '../renderer/index.html'));
  setupUpdater(() => win);
}

app.on('before-quit', () => db?.saveNow());
app.on('window-all-closed', () => app.quit());
