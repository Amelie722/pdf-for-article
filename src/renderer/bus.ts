// 화면 쪽 모듈끼리 주고받는 이벤트. 모듈은 서로를 직접 부르지 않고 이벤트로 연결한다.
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { DocumentRecord } from '../shared/types';

export interface BusEvents {
  'document:opened': { doc: DocumentRecord; pdf: PDFDocumentProxy };
  'document:closed': undefined;
  'annotations:changed': { docId: string };
  'viewer:pages-rendered': { page: number };
}

type Handler<T> = (payload: T) => void;

export class Bus {
  private handlers = new Map<keyof BusEvents, Set<Handler<any>>>();

  on<K extends keyof BusEvents>(event: K, fn: Handler<BusEvents[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) this.handlers.set(event, (set = new Set()));
    set.add(fn);
    return () => set!.delete(fn);
  }

  emit<K extends keyof BusEvents>(event: K, payload: BusEvents[K]): void {
    for (const fn of this.handlers.get(event) ?? []) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[bus] ${String(event)} 처리 중 오류`, err);
      }
    }
  }
}
