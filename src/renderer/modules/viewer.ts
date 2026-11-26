// PDF 보기: 페이지 표시, 확대/축소, 텍스트 선택 레이어, 화면에 보이는 페이지만 그리기.
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.min.mjs';

export interface PageView {
  index: number; // 1부터
  div: HTMLDivElement;
  canvas: HTMLCanvasElement;
  textLayer: HTMLDivElement;
  /** 하이라이트를 그리는 층. 위치는 % 단위라 확대해도 다시 그릴 필요가 없다. */
  hlLayer: HTMLDivElement;
  baseWidth: number; // scale 1 기준 크기 (pt)
  baseHeight: number;
  renderedScale: number | null;
  renderTask: RenderTask | null;
}

export class PdfViewer {
  pdf: PDFDocumentProxy | null = null;
  pages: PageView[] = [];
  scale = 1.25;
  private observer: IntersectionObserver;
  private visible = new Set<number>();
  private pageListeners: ((page: PageView) => void)[] = [];

  constructor(readonly container: HTMLElement) {
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const idx = Number((e.target as HTMLElement).dataset.page);
          if (e.isIntersecting) this.visible.add(idx);
          else this.visible.delete(idx);
        }
        this.renderVisible();
      },
      { root: container, rootMargin: '600px 0px' },
    );
  }

  /** 페이지 div가 만들어질 때마다 호출 (주석 모듈이 하이라이트를 붙이는 데 사용) */
  onPageCreated(fn: (page: PageView) => void): void {
    this.pageListeners.push(fn);
  }

  async load(data: Uint8Array): Promise<PDFDocumentProxy> {
    await this.close();
    const pdf = await pdfjsLib.getDocument({
      data,
      cMapUrl: './cmaps/',
      cMapPacked: true,
      standardFontDataUrl: './standard_fonts/',
    }).promise;
    this.pdf = pdf;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const vp = page.getViewport({ scale: 1 });
      this.pages.push(this.createPage(i, vp.width, vp.height));
    }
    this.container.scrollTop = 0;
    return pdf;
  }

  async close(): Promise<void> {
    this.observer.disconnect();
    this.visible.clear();
    for (const p of this.pages) p.renderTask?.cancel();
    this.pages = [];
    this.container.innerHTML = '';
    if (this.pdf) await this.pdf.destroy();
    this.pdf = null;
  }

  private createPage(index: number, w: number, h: number): PageView {
    const div = document.createElement('div');
    div.className = 'page';
    div.dataset.page = String(index);
    const canvasWrapper = document.createElement('div');
    canvasWrapper.className = 'canvasWrapper';
    const canvas = document.createElement('canvas');
    canvasWrapper.appendChild(canvas);
    const hlLayer = document.createElement('div');
    hlLayer.className = 'hl-layer';
    const textLayer = document.createElement('div');
    textLayer.className = 'textLayer';
    div.append(canvasWrapper, hlLayer, textLayer);
    this.container.appendChild(div);
    const view: PageView = {
      index,
      div,
      canvas,
      textLayer,
      hlLayer,
      baseWidth: w,
      baseHeight: h,
      renderedScale: null,
      renderTask: null,
    };
    this.applySize(view);
    this.observer.observe(div);
    for (const fn of this.pageListeners) fn(view);
    return view;
  }

  private applySize(p: PageView): void {
    p.div.style.width = `${Math.floor(p.baseWidth * this.scale)}px`;
    p.div.style.height = `${Math.floor(p.baseHeight * this.scale)}px`;
    p.div.style.setProperty('--scale-factor', String(this.scale));
  }

  private renderVisible(): void {
    for (const idx of this.visible) {
      const p = this.pages[idx - 1];
      if (p && p.renderedScale !== this.scale) void this.renderPage(p);
    }
  }

  private async renderPage(p: PageView): Promise<void> {
    if (!this.pdf) return;
    const scale = this.scale;
    p.renderTask?.cancel();
    p.renderedScale = scale;
    const page: PDFPageProxy = await this.pdf.getPage(p.index);
    const vp = page.getViewport({ scale });
    const dpr = window.devicePixelRatio || 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(vp.width * dpr);
    canvas.height = Math.floor(vp.height * dpr);
    canvas.style.width = `${Math.floor(vp.width)}px`;
    canvas.style.height = `${Math.floor(vp.height)}px`;
    const task = page.render({
      canvasContext: canvas.getContext('2d')!,
      viewport: vp,
      transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
    });
    p.renderTask = task;
    try {
      await task.promise;
    } catch (err: any) {
      if (err?.name === 'RenderingCancelledException') return;
      throw err;
    }
    if (p.renderedScale !== scale) return;
    p.canvas.replaceWith(canvas);
    p.canvas = canvas;
    p.renderTask = null;

    p.textLayer.innerHTML = '';
    const textLayer = new pdfjsLib.TextLayer({
      textContentSource: page.streamTextContent(),
      container: p.textLayer,
      viewport: vp,
    });
    await textLayer.render();
  }

  setScale(scale: number): void {
    const clamped = Math.min(4, Math.max(0.4, scale));
    if (!this.pdf || clamped === this.scale) {
      this.scale = clamped;
      return;
    }
    // 확대 후에도 보던 위치 유지
    const ratio = this.container.scrollTop / Math.max(1, this.container.scrollHeight);
    this.scale = clamped;
    for (const p of this.pages) this.applySize(p);
    this.container.scrollTop = ratio * this.container.scrollHeight;
    this.renderVisible();
  }

  fitWidth(): void {
    const first = this.pages[0];
    if (!first) return;
    const avail = this.container.clientWidth - 48;
    this.setScale(avail / first.baseWidth);
  }

  /** 페이지(1부터)의 yRatio(0~1) 위치로 이동 */
  scrollTo(page: number, yRatio = 0): void {
    const p = this.pages[page - 1];
    if (!p) return;
    const top = p.div.offsetTop + yRatio * p.div.offsetHeight - 80;
    this.container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }

  currentPage(): number {
    const mid = this.container.scrollTop + this.container.clientHeight / 3;
    for (const p of this.pages) {
      if (p.div.offsetTop + p.div.offsetHeight > mid) return p.index;
    }
    return this.pages.length;
  }
}
