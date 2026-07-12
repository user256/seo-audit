export type TextSelection = {
  text: string;
  selectionStart: number;
  selectionEnd: number;
};

export type FormatAction =
  | 'heading'
  | 'bold'
  | 'italic'
  | 'inlineCode'
  | 'blockCode'
  | 'ul'
  | 'ol'
  | 'link'
  | 'table';

/**
 * Apply a Markdown formatting helper while preserving / adjusting selection.
 */
export function applyMarkdownFormat(state: TextSelection, action: FormatAction): TextSelection {
  const { text, selectionStart, selectionEnd } = state;
  const selected = text.slice(selectionStart, selectionEnd);
  const before = text.slice(0, selectionStart);
  const after = text.slice(selectionEnd);

  const wrap = (prefix: string, suffix: string, placeholder: string): TextSelection => {
    const body = selected.length > 0 ? selected : placeholder;
    const next = `${before}${prefix}${body}${suffix}${after}`;
    const start = before.length + prefix.length;
    return {
      text: next,
      selectionStart: start,
      selectionEnd: start + body.length,
    };
  };

  const linePrefix = (prefix: string, placeholder: string): TextSelection => {
    const body = selected.length > 0 ? selected : placeholder;
    const lines = body.split('\n').map((line) => `${prefix}${line || placeholder}`);
    const inserted = lines.join('\n');
    const next = `${before}${inserted}${after}`;
    return {
      text: next,
      selectionStart: before.length,
      selectionEnd: before.length + inserted.length,
    };
  };

  switch (action) {
    case 'heading':
      return linePrefix('## ', 'Heading');
    case 'bold':
      return wrap('**', '**', 'bold text');
    case 'italic':
      return wrap('*', '*', 'italic text');
    case 'inlineCode':
      return wrap('`', '`', 'code');
    case 'blockCode': {
      const body = selected.length > 0 ? selected : 'code';
      const inserted = `\n\`\`\`\n${body}\n\`\`\`\n`;
      const next = `${before}${inserted}${after}`;
      const start = before.length + 5;
      return { text: next, selectionStart: start, selectionEnd: start + body.length };
    }
    case 'ul':
      return linePrefix('- ', 'list item');
    case 'ol':
      return linePrefix('1. ', 'list item');
    case 'link': {
      const label = selected.length > 0 ? selected : 'link text';
      const inserted = `[${label}](https://)`;
      const next = `${before}${inserted}${after}`;
      const urlStart = before.length + label.length + 3;
      return {
        text: next,
        selectionStart: urlStart,
        selectionEnd: urlStart + 'https://'.length,
      };
    }
    case 'table': {
      const inserted = '\n| Column | Column |\n| --- | --- |\n| Value | Value |\n';
      const next = `${before}${inserted}${after}`;
      return {
        text: next,
        selectionStart: before.length + 1,
        selectionEnd: before.length + inserted.length - 1,
      };
    }
    default: {
      const _exhaustive: never = action;
      void _exhaustive;
      return state;
    }
  }
}

export function countWords(markdown: string): number {
  const trimmed = markdown.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}
