// 하이라이트·메모: 글자 선택 → 색 선택 또는 메모 → 저장, 페이지 위에 표시, 오른쪽 목록.
import type { Annotation, NormRect } from '../../shared/types';
import { el, escapeHtml, openNoteEditor } from '../ui';
import type { RendererContext, RendererModule } from './types';
import type { PageView } from './viewer';

export const COLORS = [
  { id: 'yellow', value: '#ffd54f', label: '노랑' },
  { id: 'green', value: '#81c784', label: '초록' },
  { id: 'blue', value: '#64b5f6', label: '파랑' },
  { id: 'pink', value: '#f48fb1', label: '분홍' },
];

interface PageSelection {
  page: PageView;
  rects: NormRect[];
  text: string;
}

/** 같은 줄에 붙어 있는 사각형을 하나로 합친다. */
function mergeRects(rects: NormRect[]): NormRect[] {
  const sorted = [...rects].sort((a, b) => a.y - b.y || a.x - b.x);
  const out: NormRect[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    const sameLine = last && Math.abs(last.y - r.y) < r.h * 0.5 && Math.abs(last.h - r.h) < r.h * 0.6;
    if (sameLine && r.x <= last.x + last.w + 0.01) {
      const right = Math.max(last.x + last.w, r.x + r.w);
      const top = Math.min(last.y, r.y);
      const bottom = Math.max(last.y + last.h, r.y + r.h);
      last.x = Math.min(last.x, r.x);
      last.w = right - last.x;
      last.y = top;
      last.h = bottom - top;
    } else {
      out.push({ ...r });
    }
  }
  return out;
}

/** 줄바꿈 하이픈은 남기고(복합어 보호), 공백을 정리한다. */
const cleanText = (s: string) => s.replace(/-\n\s*/g, '-').replace(/\s+/g, ' ').trim();

/** 선택 범위의 글자. pdf.js는 줄 끝을 <br>로 표시하므로 공백으로 바꿔 단어가 붙지 않게 한다. */
function rangeText(r: Range): string {
  const frag = r.cloneContents();
  frag.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  return frag.textContent ?? '';
}

function readSelection(pages: PageView[]): PageSelection[] {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return [];
  const range = sel.getRangeAt(0);
  const result: PageSelection[] = [];
  for (const page of pages) {
    if (!range.intersectsNode(page.textLayer)) continue;
    // 이 페이지에 해당하는 부분만 잘라낸다
    const pr = document.createRange();
    pr.selectNodeContents(page.textLayer);
    if (range.compareBoundaryPoints(Range.START_TO_START, pr) > 0) pr.setStart(range.startContainer, range.startOffset);
    if (range.compareBoundaryPoints(Range.END_TO_END, pr) < 0) pr.setEnd(range.endContainer, range.endOffset);
    const box = page.div.getBoundingClientRect();
    const rects = Array.from(pr.getClientRects())
      .filter((r) => r.width > 1 && r.height > 1)
      .map((r) => ({
        x: (r.left - box.left) / box.width,
        y: (r.top - box.top) / box.height,
        w: r.width / box.width,
        h: r.height / box.height,
      }))
      .filter((r) => r.x >= -0.01 && r.y >= -0.01 && r.x < 1 && r.y < 1);
    const text = cleanText(rangeText(pr));
    if (rects.length && text) result.push({ page, rects: mergeRects(rects), text });
  }
  return result;
}

export const annotationsModule: RendererModule = {
  id: 'annotations',
  setup(ctx: RendererContext) {
    const { api, bus, viewer } = ctx;
    let items: Annotation[] = [];
    const listEl = document.getElementById('annotation-list')!;
    const countEl = document.getElementById('annotation-count')!;
    const toolbar = document.getElementById('selection-toolbar')!;

    // ---- 선택 도구막대 ----
    toolbar.innerHTML =
      COLORS.map(
        (c) => `<button class="swatch" data-color="${c.value}" title="${c.label} 하이라이트" style="background:${c.value}"></button>`,
      ).join('') + `<button class="note-btn" data-action="note" title="메모 남기기">메모</button>`;
    toolbar.addEventListener('mousedown', (e) => e.preventDefault()); // 선택 유지

    let pending: PageSelection[] = [];
    const hideToolbar = () => {
      toolbar.hidden = true;
      pending = [];
    };

    viewer.container.addEventListener('mouseup', () => {
      setTimeout(() => {
        pending = readSelection(viewer.pages);
        if (!pending.length) return hideToolbar();
        const r = window.getSelection()!.getRangeAt(0).getBoundingClientRect();
        toolbar.hidden = false;
        const tw = toolbar.offsetWidth;
        toolbar.style.left = `${Math.max(8, Math.min(window.innerWidth - tw - 8, r.left + r.width / 2 - tw / 2))}px`;
        toolbar.style.top = `${r.bottom + 8 > window.innerHeight - 50 ? r.top - 48 : r.bottom + 8}px`;
      }, 0);
    });
    viewer.container.addEventListener('scroll', hideToolbar);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hideToolbar();
    });

    const create = async (color: string, note: string) => {
      const doc = ctx.currentDoc();
      if (!doc) return;
      const sel = pending;
      hideToolbar();
      window.getSelection()?.removeAllRanges();
      for (const s of sel) {
        await api.addAnnotation({
          docId: doc.id,
          page: s.page.index,
          kind: note ? 'note' : 'highlight',
          color,
          text: s.text,
          note,
          rects: s.rects,
        });
      }
      bus.emit('annotations:changed', { docId: doc.id });
    };

    toolbar.addEventListener('click', async (e) => {
      const btn = (e.target as HTMLElement).closest('button');
      if (!btn) return;
      if (btn.dataset.color) return create(btn.dataset.color, '');
      if (btn.dataset.action === 'note') {
        const sel = pending;
        const quote = sel.map((s) => s.text).join(' ');
        hideToolbar();
        const note = await openNoteEditor({ quote, initial: '' });
        if (note !== null && note.trim()) {
          pending = sel;
          await create(COLORS[0].value, note.trim());
        }
      }
    });

    // ---- 페이지 위 하이라이트 ----
    const drawPage = (page: PageView) => {
      page.hlLayer.innerHTML = '';
      for (const a of items.filter((x) => x.page === page.index)) {
        a.rects.forEach((r, i) => {
          const d = el('div', { class: 'hl' + (a.kind === 'note' ? ' hl-note' : '') });
          d.dataset.id = a.id;
          d.style.cssText = `left:${r.x * 100}%;top:${r.y * 100}%;width:${r.w * 100}%;height:${r.h * 100}%;background:${a.color}`;
          if (a.kind === 'note' && i === 0) d.appendChild(el('span', { class: 'note-marker', title: a.note }, '✎'));
          page.hlLayer.appendChild(d);
        });
      }
    };
    viewer.onPageCreated(drawPage);

    // 하이라이트 위를 클릭하면 목록에서 해당 항목을 보여준다
    viewer.container.addEventListener('click', (e) => {
      if (!window.getSelection()?.isCollapsed) return;
      const pageDiv = (e.target as HTMLElement).closest('.page') as HTMLElement | null;
      if (!pageDiv) return;
      const page = viewer.pages[Number(pageDiv.dataset.page) - 1];
      const box = pageDiv.getBoundingClientRect();
      const px = (e.clientX - box.left) / box.width;
      const py = (e.clientY - box.top) / box.height;
      const hit = items.find(
        (a) => a.page === page.index && a.rects.some((r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h),
      );
      if (hit) focusCard(hit.id);
    });

    const focusCard = (id: string) => {
      document.body.classList.remove('sidebar-hidden');
      const card = listEl.querySelector<HTMLElement>(`[data-id="${id}"]`);
      if (!card) return;
      card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      card.classList.remove('flash');
      void card.offsetWidth;
      card.classList.add('flash');
    };

    // ---- 오른쪽 목록 ----
    const renderList = () => {
      countEl.textContent = String(items.length);
      if (!items.length) {
        listEl.innerHTML = `<p class="empty">글자를 드래그해서 선택하면<br>하이라이트·메모를 남길 수 있습니다.</p>`;
        return;
      }
      listEl.innerHTML = items
        .map(
          (a) => `
        <article class="card" data-id="${a.id}" style="--c:${a.color}">
          <header><span class="page-tag">p.${a.page}</span>${a.kind === 'note' ? '<span class="kind-tag">메모</span>' : ''}
            <span class="spacer"></span>
            ${COLORS.map((c) => `<button class="mini-swatch" data-act="color" data-color="${c.value}" style="background:${c.value}" title="${c.label}"></button>`).join('')}
            <button class="icon" data-act="edit" title="메모 편집">✎</button>
            <button class="icon" data-act="delete" title="삭제">🗑</button>
          </header>
          <blockquote>${escapeHtml(a.text)}</blockquote>
          ${a.note ? `<p class="note">${escapeHtml(a.note)}</p>` : ''}
        </article>`,
        )
        .join('');
    };

    listEl.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      const card = target.closest<HTMLElement>('.card');
      if (!card) return;
      const a = items.find((x) => x.id === card.dataset.id);
      if (!a) return;
      const act = target.closest<HTMLElement>('button')?.dataset.act;
      if (act === 'delete') {
        if (!confirm('이 항목을 삭제할까요?')) return;
        await api.deleteAnnotation(a.id);
      } else if (act === 'color') {
        await api.updateAnnotation(a.id, { color: target.dataset.color! });
      } else if (act === 'edit') {
        const note = await openNoteEditor({ quote: a.text, initial: a.note });
        if (note === null) return;
        await api.updateAnnotation(a.id, { note: note.trim(), kind: note.trim() ? 'note' : 'highlight' });
      } else {
        viewer.scrollTo(a.page, a.rects[0]?.y ?? 0);
        return;
      }
      bus.emit('annotations:changed', { docId: a.docId });
    });

    const reload = async () => {
      const doc = ctx.currentDoc();
      items = doc ? await api.listAnnotations(doc.id) : [];
      renderList();
      for (const p of viewer.pages) drawPage(p);
    };

    bus.on('document:opened', reload);
    bus.on('document:closed', reload);
    bus.on('annotations:changed', ({ docId }) => {
      if (ctx.currentDoc()?.id === docId) void reload();
    });
  },
};
