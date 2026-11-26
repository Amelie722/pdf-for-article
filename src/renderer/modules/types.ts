// 화면 쪽 기능 모듈의 공통 형태.
import type { Api, DocumentRecord } from '../../shared/types';
import type { Bus } from '../bus';
import type { PdfViewer } from './viewer';

export interface RendererContext {
  api: Api;
  bus: Bus;
  viewer: PdfViewer;
  /** 지금 열려 있는 문서 (없으면 null) */
  currentDoc(): DocumentRecord | null;
  /** 경로로 PDF를 연다. 이미 열린 문서면 다시 읽지 않는다. */
  openPath(path: string): Promise<void>;
}

export interface RendererModule {
  id: string;
  setup(ctx: RendererContext): void;
}
