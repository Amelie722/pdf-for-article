// main 프로세스 기능 모듈의 공통 형태.
// 새 기능(예: 논문 감지, 서지, 번역)은 MainModule을 하나 만들어 modules/index.ts에 등록한다.
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import type { Db } from '../db';

export interface ModuleContext {
  db: Db;
  getWindow(): BrowserWindow | null;
  /** renderer가 window.api로 부를 수 있는 함수 등록 */
  handle(channel: string, fn: (event: IpcMainInvokeEvent, ...args: any[]) => unknown): void;
}

export interface MainModule {
  id: string;
  setup(ctx: ModuleContext): void | Promise<void>;
}
