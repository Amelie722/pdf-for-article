// 화면 시작점: 뷰어 생성, 모듈 연결, 파일 열기·확대·단축키 처리.
import type { Api, DocumentRecord } from '../shared/types';
import { Bus } from './bus';
import { modules } from './modules';
import type { RendererContext } from './modules/types';
import { PdfViewer } from './modules/viewer';

declare global {
  interface Window {
    api: Api;
    menu: { onCommand(cb: (cmd: string) => void): void };
  }
}

const api = window.api;
const bus = new Bus();
const viewer = new PdfViewer(document.getElementById('viewer')!);
const titleEl = document.getElementById('doc-title')!;
const zoomEl = document.getElementById('zoom-label')!;
let current: DocumentRecord | null = null;
let opening: Promise<void> | null = null;

function showView(view: 'home' | 'reader') {
  document.body.dataset.view = view;
}

async function openPath(path: string): Promise<void> {
  if (current && current.path === path) return;
  const run = async () => {
    const { doc, data } = await api.openPath(path);
    if (current?.id === doc.id && viewer.pdf) {
      current = doc;
      return;
    }
    const pdf = await viewer.load(data);
    current = doc;
    titleEl.textContent = doc.fileName;
    titleEl.title = doc.path;
    document.title = `${doc.fileName} - 논문 리더`;
    showView('reader');
    viewer.fitWidth();
    updateZoom();
    bus.emit('document:opened', { doc, pdf });
  };
  opening = (opening ?? Promise.resolve()).then(run, run);
  return opening;
}

async function goHome() {
  await viewer.close();
  current = null;
  titleEl.textContent = '';
  document.title = '논문 리더';
  showView('home');
  bus.emit('document:closed', undefined);
}

async function openDialog() {
  const p = await api.openFileDialog();
  if (p) await openPath(p).catch(showError);
}

function showError(err: unknown) {
  console.error(err);
  alert(`PDF를 열 수 없습니다.\n${err instanceof Error ? err.message : String(err)}`);
}

function updateZoom() {
  zoomEl.textContent = `${Math.round(viewer.scale * 100)}%`;
}

function command(cmd: string) {
  switch (cmd) {
    case 'open':
      return void openDialog();
    case 'home':
      return void goHome();
    case 'zoom-in':
      viewer.setScale(viewer.scale * 1.15);
      return updateZoom();
    case 'zoom-out':
      viewer.setScale(viewer.scale / 1.15);
      return updateZoom();
    case 'zoom-fit':
      viewer.fitWidth();
      return updateZoom();
    case 'toggle-sidebar':
      return void document.body.classList.toggle('sidebar-hidden');
    default:
      window.dispatchEvent(new CustomEvent('app:command', { detail: cmd }));
  }
}

const ctx: RendererContext = { api, bus, viewer, currentDoc: () => current, openPath };
for (const m of modules) m.setup(ctx);

// 버튼
document.querySelectorAll<HTMLElement>('[data-cmd]').forEach((b) =>
  b.addEventListener('click', () => command(b.dataset.cmd!)),
);
window.menu.onCommand(command);

// Ctrl + 마우스 휠 확대
viewer.container.addEventListener(
  'wheel',
  (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    command(e.deltaY < 0 ? 'zoom-in' : 'zoom-out');
  },
  { passive: false },
);

// 끌어다 놓기
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault();
  const file = e.dataTransfer?.files[0];
  if (file && file.name.toLowerCase().endsWith('.pdf')) void openPath(api.getPathForFile(file)).catch(showError);
});

// 다른 곳에서 PDF를 열었을 때 (이미 실행 중인 상태)
api.onOpenPath((p) => void openPath(p).catch(showError));

// 처음 실행될 때 받은 PDF
showView('home');
api.getInitialPath().then((p) => {
  if (p) void openPath(p).catch(showError);
});
