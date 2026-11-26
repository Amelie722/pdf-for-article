// 모아보기: 모든 문서의 하이라이트·메모를 한 화면에서 거르고, 찾고, 복사한다.
import type { AnnotationWithDoc } from '../../shared/types';
import { escapeHtml } from '../ui';
import { COLORS } from './annotations';
import type { RendererContext, RendererModule } from './types';

export const collectionModule: RendererModule = {
  id: 'collection',
  setup(ctx: RendererContext) {
    const { api, viewer } = ctx;
    const panel = document.getElementById('collection')!;
    const listEl = panel.querySelector<HTMLElement>('.collection-list')!;
    const scopeEl = panel.querySelector<HTMLSelectElement>('[name=scope]')!;
    const kindEl = panel.querySelector<HTMLSelectElement>('[name=kind]')!;
    const colorEl = panel.querySelector<HTMLSelectElement>('[name=color]')!;
    const searchEl = panel.querySelector<HTMLInputElement>('[name=q]')!;
    const statusEl = panel.querySelector<HTMLElement>('.collection-status')!;
    colorEl.innerHTML =
      '<option value="">모든 색</option>' + COLORS.map((c) => `<option value="${c.value}">${c.label}</option>`).join('');

    let all: AnnotationWithDoc[] = [];

    const filtered = () => {
      const q = searchEl.value.trim().toLowerCase();
      const docId = ctx.currentDoc()?.id;
      return all.filter(
        (a) =>
          (scopeEl.value === 'all' || a.docId === docId) &&
          (!kindEl.value || a.kind === kindEl.value) &&
          (!colorEl.value || a.color === colorEl.value) &&
          (!q || a.text.toLowerCase().includes(q) || a.note.toLowerCase().includes(q) || a.fileName.toLowerCase().includes(q)),
      );
    };

    const render = () => {
      const rows = filtered();
      statusEl.textContent = `${rows.length}개`;
      if (!rows.length) {
        listEl.innerHTML = '<p class="empty">조건에 맞는 하이라이트·메모가 없습니다.</p>';
        return;
      }
      const groups = new Map<string, AnnotationWithDoc[]>();
      for (const a of rows) {
        if (!groups.has(a.docId)) groups.set(a.docId, []);
        groups.get(a.docId)!.push(a);
      }
      listEl.innerHTML = [...groups.values()]
        .map(
          (g) => `
        <section class="doc-group">
          <h3 title="${escapeHtml(g[0].path)}">${escapeHtml(g[0].fileName)} <small>${g.length}개</small></h3>
          ${g
            .map(
              (a) => `
            <article class="card" data-id="${a.id}" style="--c:${a.color}">
              <header><span class="page-tag">p.${a.page}</span>${a.kind === 'note' ? '<span class="kind-tag">메모</span>' : ''}</header>
              <blockquote>${escapeHtml(a.text)}</blockquote>
              ${a.note ? `<p class="note">${escapeHtml(a.note)}</p>` : ''}
            </article>`,
            )
            .join('')}
        </section>`,
        )
        .join('');
    };

    const open = async () => {
      all = await api.listAllAnnotations();
      if (!ctx.currentDoc()) scopeEl.value = 'all';
      render();
      panel.hidden = false;
      searchEl.focus();
    };
    const close = () => (panel.hidden = true);

    for (const input of [scopeEl, kindEl, colorEl]) input.addEventListener('change', render);
    searchEl.addEventListener('input', render);
    panel.querySelector('[data-act=close]')!.addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !panel.hidden) close();
    });

    panel.querySelector('[data-act=copy]')!.addEventListener('click', async () => {
      const rows = filtered();
      const lines: string[] = [];
      let lastDoc = '';
      for (const a of rows) {
        if (a.docId !== lastDoc) {
          lines.push(`${lines.length ? '\n' : ''}## ${a.fileName}\n`);
          lastDoc = a.docId;
        }
        lines.push(`- (p.${a.page}) "${a.text}"`);
        if (a.note) lines.push(`  - 메모: ${a.note}`);
      }
      await navigator.clipboard.writeText(lines.join('\n'));
      statusEl.textContent = `${rows.length}개 복사됨`;
    });

    listEl.addEventListener('click', async (e) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>('.card');
      const a = all.find((x) => x.id === card?.dataset.id);
      if (!a) return;
      close();
      try {
        await ctx.openPath(a.path);
      } catch {
        alert(`파일을 찾을 수 없습니다.\n${a.path}\n\n파일을 옮겼다면 새 위치에서 한 번 열어 주세요. 하이라이트는 그대로 연결됩니다.`);
        return;
      }
      setTimeout(() => viewer.scrollTo(a.page, a.rects[0]?.y ?? 0), 50);
    });

    document.getElementById('btn-collection')!.addEventListener('click', open);
    window.addEventListener('app:command', (e) => {
      if ((e as CustomEvent).detail === 'collection') void open();
    });
  },
};
