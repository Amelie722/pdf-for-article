// 화면 쪽 기능 모듈 목록. 새 모듈은 여기에 한 줄 추가한다.
import { annotationsModule } from './annotations';
import { collectionModule } from './collection';
import { homeModule } from './home';
import type { RendererModule } from './types';

export const modules: RendererModule[] = [homeModule, annotationsModule, collectionModule];
