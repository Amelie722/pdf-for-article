// 홈 화면: 최근 문서 목록.
import { escapeHtml } from '../ui';
import type { RendererContext, RendererModule } from './types';

export const homeModule: RendererModule = {
  id: 'home',
  setup(ctx: RendererContext) {
    const listEl = document.getElementById('recent-list')!;
    const render = async () => {
      const docs = await ctx.api.recentDocuments(20);
      listEl.innerHTML = docs.length
        ? docs
            .map(
              (d) => `<li data-path="${escapeHtml(d.path)}"><strong>${escapeHtml(d.fileName)}</strong>
                <small>${escapeHtml(d.path)} · ${new Date(d.lastOpenedAt).toLocaleString('ko-KR')}</small></li>`,
            )
            .join('')
        : '<li class="empty">아직 연 문서가 없습니다.</li>';
    };
    listEl.addEventListener('click', async (e) => {
      const li = (e.target as HTMLElement).closest<HTMLElement>('li[data-path]');
      if (!li) return;
      try {
        await ctx.openPath(li.dataset.path!);
      } catch {
        alert(`파일을 찾을 수 없습니다.\n${li.dataset.path}`);
      }
    });
    ctx.bus.on('document:closed', () => void render());
    void render();
  },
};
