import DOMPurify from 'dompurify';
import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: false,
});

/**
 * Preview allowlist (Ticket 108): ordinary Markdown structure, tables, and
 * code — no images, raw HTML hosts, forms, styles, or scripts.
 */
export const MARKDOWN_PREVIEW_ALLOWED_TAGS = [
  'a',
  'blockquote',
  'br',
  'code',
  'del',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'strong',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'ul',
] as const;

export const MARKDOWN_PREVIEW_ALLOWED_ATTR = [
  'href',
  'title',
  'colspan',
  'rowspan',
  'align',
] as const;

let hooksInstalled = false;

function ensureSanitizeHooks(): void {
  if (hooksInstalled) return;
  hooksInstalled = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node instanceof HTMLAnchorElement) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
      const href = node.getAttribute('href') ?? '';
      if (/^\s*javascript:/i.test(href) || /^\s*data:/i.test(href) || /^\s*vbscript:/i.test(href)) {
        node.removeAttribute('href');
      }
    }
  });
}

/**
 * Render Markdown to sanitised HTML. Preview HTML is transient — never persist it.
 * Uses pinned local `marked` + `dompurify` (no remote CDN). Images and raw HTML
 * hosts are stripped so preview cannot trigger network loads.
 */
export function renderSafeMarkdownPreview(markdown: string): string {
  if (!markdown.trim()) {
    return '';
  }
  ensureSanitizeHooks();
  const raw = marked.parse(markdown, { async: false }) as string;
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: [...MARKDOWN_PREVIEW_ALLOWED_TAGS],
    ALLOWED_ATTR: [...MARKDOWN_PREVIEW_ALLOWED_ATTR],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: [
      'img',
      'picture',
      'source',
      'video',
      'audio',
      'svg',
      'math',
      'style',
      'script',
      'form',
      'input',
      'button',
      'textarea',
      'iframe',
      'object',
      'embed',
      'link',
      'meta',
      'base',
    ],
    FORBID_ATTR: ['style', 'src', 'srcset', 'poster'],
  });
}
