/** Minimal XML tree for sitemap parsing without DOMParser. */

export type SimpleElement = {
  tagName: string;
  localName: string;
  attributes: Record<string, string>;
  children: SimpleElement[];
  /** Direct character data between this element's tags (not descendants). */
  directText: string;
};

export type SimpleDocument = {
  documentElement: SimpleElement | null;
};

export type SimpleXmlParseSuccess = { ok: true; doc: SimpleDocument };
export type SimpleXmlParseFailure = { ok: false; error: string };
export type SimpleXmlParseResult = SimpleXmlParseSuccess | SimpleXmlParseFailure;

function toLocalName(tagName: string): string {
  const colon = tagName.indexOf(':');
  return colon === -1 ? tagName : tagName.slice(colon + 1);
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num: string) => String.fromCodePoint(parseInt(num, 10)));
}

function textContent(el: SimpleElement): string {
  const parts: string[] = [];
  if (el.directText) parts.push(el.directText);
  for (const child of el.children) {
    parts.push(textContent(child));
  }
  return decodeXmlEntities(parts.join(''));
}

export function simpleElementText(el: SimpleElement | null | undefined): string | undefined {
  if (!el) return undefined;
  const value = textContent(el);
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export function simpleElementsByLocalName(
  parent: SimpleElement | SimpleDocument,
  localName: string,
): SimpleElement[] {
  const out: SimpleElement[] = [];
  const walk = (node: SimpleElement): void => {
    if (node.localName === localName) out.push(node);
    for (const child of node.children) walk(child);
  };
  if ('documentElement' in parent) {
    if (parent.documentElement) walk(parent.documentElement);
  } else {
    walk(parent);
  }
  return out;
}

export function simpleChildByLocalName(
  parent: SimpleElement,
  localName: string,
): SimpleElement | undefined {
  for (const child of parent.children) {
    if (child.localName === localName) return child;
  }
  return undefined;
}

type ParserState = {
  input: string;
  pos: number;
};

function eof(state: ParserState): boolean {
  return state.pos >= state.input.length;
}

function peek(state: ParserState, offset = 0): string {
  return state.input[state.pos + offset] ?? '';
}

function consume(state: ParserState, count = 1): string {
  const slice = state.input.slice(state.pos, state.pos + count);
  state.pos += count;
  return slice;
}

function skipWhitespace(state: ParserState): void {
  while (!eof(state) && /\s/.test(peek(state))) consume(state);
}

function parseName(state: ParserState): string {
  let name = '';
  while (!eof(state) && /[\w:.-]/.test(peek(state))) {
    name += consume(state);
  }
  return name;
}

function parseAttributeValue(state: ParserState): string {
  skipWhitespace(state);
  const quote = peek(state);
  if (quote === '"' || quote === "'") {
    consume(state);
    let value = '';
    while (!eof(state) && peek(state) !== quote) {
      value += consume(state);
    }
    if (peek(state) === quote) consume(state);
    return decodeXmlEntities(value);
  }
  let value = '';
  while (!eof(state) && !/\s/.test(peek(state))) {
    value += consume(state);
  }
  return decodeXmlEntities(value);
}

function parseAttributes(state: ParserState): Record<string, string> {
  const attrs: Record<string, string> = {};
  while (!eof(state)) {
    skipWhitespace(state);
    if (peek(state) === '>' || peek(state) === '/') break;
    const name = parseName(state);
    if (!name) break;
    skipWhitespace(state);
    if (peek(state) !== '=') continue;
    consume(state);
    attrs[name] = parseAttributeValue(state);
  }
  return attrs;
}

function skipProcessingInstruction(state: ParserState): void {
  while (!eof(state)) {
    if (peek(state) === '?' && peek(state, 1) === '>') {
      consume(state, 2);
      return;
    }
    consume(state);
  }
}

function skipComment(state: ParserState): void {
  if (peek(state, 2) !== '--') return;
  consume(state, 3);
  while (!eof(state)) {
    if (peek(state) === '-' && peek(state, 1) === '-' && peek(state, 2) === '>') {
      consume(state, 3);
      return;
    }
    consume(state);
  }
}

function parseTextUntilTag(state: ParserState): string {
  let text = '';
  while (!eof(state) && peek(state) !== '<') {
    text += consume(state);
  }
  return text;
}

function parseElement(state: ParserState): SimpleElement | null {
  skipWhitespace(state);
  if (eof(state) || peek(state) !== '<') return null;
  consume(state);

  if (peek(state) === '?') {
    consume(state);
    skipProcessingInstruction(state);
    return parseElement(state);
  }

  if (peek(state) === '!') {
    consume(state);
    if (peek(state) === '-' && peek(state, 1) === '-') {
      skipComment(state);
      return parseElement(state);
    }
    throw new Error('Unsupported markup declaration in sitemap XML.');
  }

  const tagName = parseName(state);
  if (!tagName) throw new Error('Invalid start tag.');

  const attributes = parseAttributes(state);
  skipWhitespace(state);

  const selfClosing = peek(state) === '/';
  if (selfClosing) {
    consume(state);
    if (peek(state) !== '>') throw new Error('Malformed self-closing tag.');
    consume(state);
    return {
      tagName,
      localName: toLocalName(tagName),
      attributes,
      children: [],
      directText: '',
    };
  }

  if (peek(state) !== '>') throw new Error('Malformed start tag.');
  consume(state);

  const children: SimpleElement[] = [];
  let directText = '';

  while (!eof(state)) {
    if (peek(state) === '<' && peek(state, 1) === '/') {
      consume(state, 2);
      const closeName = parseName(state);
      skipWhitespace(state);
      if (peek(state) !== '>') throw new Error('Malformed end tag.');
      consume(state);
      if (closeName !== tagName) {
        throw new Error(`Mismatched end tag </${closeName}>; expected </${tagName}>.`);
      }
      return {
        tagName,
        localName: toLocalName(tagName),
        attributes,
        children,
        directText,
      };
    }

    if (peek(state) === '<') {
      const child = parseElement(state);
      if (child) children.push(child);
      continue;
    }

    directText += parseTextUntilTag(state);
  }

  throw new Error(`Unclosed element <${tagName}>.`);
}

/**
 * Parse a small, well-formed XML document into a minimal element tree.
 * Intended for sitemap urlset / sitemapindex only — not a general XML parser.
 */
export function parseSimpleXml(xml: string): SimpleXmlParseResult {
  const state: ParserState = { input: xml, pos: 0 };
  try {
    skipWhitespace(state);
    let root: SimpleElement | null = null;

    while (!eof(state)) {
      skipWhitespace(state);
      if (eof(state)) break;

      if (peek(state) === '<' && peek(state, 1) === '?') {
        consume(state, 2);
        skipProcessingInstruction(state);
        continue;
      }

      if (peek(state) === '<' && peek(state, 1) === '!') {
        consume(state, 2);
        if (peek(state) === '-' && peek(state, 1) === '-') {
          skipComment(state);
          continue;
        }
        return { ok: false, error: 'Unsupported markup declaration in sitemap XML.' };
      }

      if (peek(state) === '<') {
        if (root) {
          return { ok: false, error: 'XML document has multiple root elements.' };
        }
        root = parseElement(state);
        continue;
      }

      return { ok: false, error: 'Unexpected content before root element.' };
    }

    if (!root) {
      return { ok: false, error: 'XML document has no root element.' };
    }

    return { ok: true, doc: { documentElement: root } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/** Raw text including whitespace (for locRaw). */
export function simpleElementRawText(el: SimpleElement | null | undefined): string {
  if (!el) return '';
  const parts: string[] = [];
  if (el.directText) parts.push(el.directText);
  for (const child of el.children) {
    parts.push(simpleElementRawText(child));
  }
  return decodeXmlEntities(parts.join(''));
}
