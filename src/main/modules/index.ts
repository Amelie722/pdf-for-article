// 등록된 기능 모듈 목록. 새 모듈은 여기에 한 줄 추가한다.
import { annotationsModule } from './annotations';
import { documentsModule } from './documents';
import type { MainModule } from './types';

export const modules: MainModule[] = [documentsModule, annotationsModule];
