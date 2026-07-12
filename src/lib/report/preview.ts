import DOMPurify from 'dompurify';
import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: false,
});

let hooksInstalled = false;

function ensureLinkHooks(): void {
  if (hooksInstalled) return;
  hooksInstalled = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node instanceof HTMLAnchorElement) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
      const href = node.getAttribute('href') ?? '';
      if (/^\s*javascript:/i.test(href) || /^\s*data:/i.test(href)) {
        node.removeAttribute('href');
      }
    }
  });
}

/**
 * Render Markdown to sanitised HTML. Preview HTML is transient — never persist it.
 * Uses pinned local `marked` + `dompurify` (no remote CDN).
 */
export function renderSafeMarkdownPreview(markdown: string): string {
  if (!markdown.trim()) {
    return '';
  }
  ensureLinkHooks();
  const raw = marked.parse(markdown, { async: false }) as string;
  return DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: [
      'style',
      'script',
      'form',
      'input',
      'button',
      'textarea',
      'iframe',
      'object',
      'embed',
    ],
  });
}
