// main과 renderer가 함께 쓰는 데이터 형태.
// 기능을 추가할 때는 여기에 타입을 먼저 정의한다.

export interface DocumentRecord {
  /** 파일 내용의 SHA-256. 파일 이름을 바꾸거나 옮겨도 같은 문서로 인식된다. */
  id: string;
  path: string;
  fileName: string;
  addedAt: string;
  lastOpenedAt: string;
}

/** 페이지 크기 대비 비율(0~1)로 저장한 사각형. 확대 배율과 무관하다. */
export interface NormRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type AnnotationKind = 'highlight' | 'note';

export interface Annotation {
  id: string;
  docId: string;
  /** 1부터 시작하는 페이지 번호 */
  page: number;
  kind: AnnotationKind;
  color: string;
  /** 하이라이트한 원문 */
  text: string;
  /** 메모 내용 (하이라이트만 있으면 빈 문자열) */
  note: string;
  rects: NormRect[];
  createdAt: string;
  updatedAt: string;
}

export type NewAnnotation = Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>;
export type AnnotationPatch = Partial<Pick<Annotation, 'color' | 'note' | 'kind'>>;

export interface AnnotationWithDoc extends Annotation {
  fileName: string;
  path: string;
}

export interface OpenedFile {
  doc: DocumentRecord;
  data: Uint8Array;
}

/** renderer에서 window.api로 부르는 함수 목록 (preload가 구현) */
export interface Api {
  openFileDialog(): Promise<string | null>;
  openPath(path: string): Promise<OpenedFile>;
  getInitialPath(): Promise<string | null>;
  onOpenPath(cb: (path: string) => void): void;
  getPathForFile(file: File): string;
  recentDocuments(limit: number): Promise<DocumentRecord[]>;
  listAnnotations(docId: string): Promise<Annotation[]>;
  listAllAnnotations(): Promise<AnnotationWithDoc[]>;
  addAnnotation(a: NewAnnotation): Promise<Annotation>;
  updateAnnotation(id: string, patch: AnnotationPatch): Promise<Annotation>;
  deleteAnnotation(id: string): Promise<void>;
}

/** IPC 채널 이름. 모듈 이름을 앞에 붙인다. */
export const Channels = {
  openFileDialog: 'documents:open-dialog',
  openPath: 'documents:open-path',
  initialPath: 'documents:initial-path',
  openPathEvent: 'documents:open-path-event',
  recent: 'documents:recent',
  listAnnotations: 'annotations:list',
  listAllAnnotations: 'annotations:list-all',
  addAnnotation: 'annotations:add',
  updateAnnotation: 'annotations:update',
  deleteAnnotation: 'annotations:delete',
} as const;
