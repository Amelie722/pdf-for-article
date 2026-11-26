// 화면 공통 도우미.

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** 메모 입력 창. 저장하면 내용, 취소하면 null */
export function openNoteEditor(opts: { quote: string; initial: string }): Promise<string | null> {
  const dlg = document.getElementById('note-dialog') as HTMLDialogElement;
  const quote = dlg.querySelector('blockquote')!;
  const ta = dlg.querySelector('textarea')!;
  quote.textContent = opts.quote;
  ta.value = opts.initial;
  dlg.showModal();
  ta.focus();
  return new Promise((resolve) => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        dlg.close('save');
      }
    };
    ta.addEventListener('keydown', onKey);
    dlg.addEventListener(
      'close',
      () => {
        ta.removeEventListener('keydown', onKey);
        resolve(dlg.returnValue === 'save' ? ta.value : null);
        dlg.returnValue = '';
      },
      { once: true },
    );
  });
}
