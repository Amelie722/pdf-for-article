// 자동 업데이트: GitHub Releases에서 새 버전을 확인하고, 받아 두었다가 재시작할 때 설치한다.
import { app, BrowserWindow, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';

let manualCheck = false;

export function setupUpdater(getWindow: () => BrowserWindow | null): void {
  if (!app.isPackaged) return; // 개발 중에는 끈다
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-downloaded', async (info) => {
    const win = getWindow();
    const opts = {
      type: 'info' as const,
      buttons: ['지금 재시작', '나중에'],
      defaultId: 0,
      cancelId: 1,
      title: '업데이트 준비 완료',
      message: `새 버전 ${info.version}을 받았습니다.`,
      detail: '지금 재시작하면 바로 적용됩니다. "나중에"를 누르면 앱을 닫을 때 적용됩니다.',
    };
    const res = win ? await dialog.showMessageBox(win, opts) : await dialog.showMessageBox(opts);
    if (res.response === 0) autoUpdater.quitAndInstall();
  });

  autoUpdater.on('update-not-available', () => {
    if (!manualCheck) return;
    manualCheck = false;
    void dialog.showMessageBox({ type: 'info', message: `최신 버전입니다 (${app.getVersion()}).` });
  });

  autoUpdater.on('error', (err) => {
    console.error('[updater]', err);
    if (!manualCheck) return; // 자동 확인 실패는 조용히 넘긴다 (오프라인 등)
    manualCheck = false;
    void dialog.showMessageBox({ type: 'warning', message: '업데이트를 확인하지 못했습니다.', detail: String(err?.message ?? err) });
  });

  void autoUpdater.checkForUpdates().catch(() => undefined);
}

export function checkForUpdatesManually(): void {
  if (!app.isPackaged) {
    void dialog.showMessageBox({ type: 'info', message: '개발 모드에서는 업데이트를 확인하지 않습니다.' });
    return;
  }
  manualCheck = true;
  void autoUpdater.checkForUpdates().catch(() => undefined);
}
