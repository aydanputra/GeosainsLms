import sanitizeHtml from 'sanitize-html';

const DEFAULT_ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'blockquote',
  'code',
  'pre',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'a',
  'img',
];

const DEFAULT_ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions['allowedAttributes'] = {
  a: ['href', 'name', 'target', 'rel'],
  img: ['src', 'alt', 'title', 'width', 'height'],
};

function sanitizeAnchorTag(tagName: string, attribs: Record<string, string>) {
  const href = typeof attribs.href === 'string' ? attribs.href.trim() : '';
  const target = attribs.target === '_blank' ? '_blank' : undefined;

  return {
    tagName,
    attribs: {
      ...(href ? { href } : {}),
      ...(target ? { target } : {}),
      ...(href ? { rel: 'noopener noreferrer nofollow' } : {}),
    },
  };
}

export function sanitizeRichHtml(input: string | null | undefined): string {
  if (typeof input !== 'string' || !input.trim()) {
    return '';
  }

  return sanitizeHtml(input, {
    allowedTags: DEFAULT_ALLOWED_TAGS,
    allowedAttributes: DEFAULT_ALLOWED_ATTRIBUTES,
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    transformTags: {
      a: sanitizeAnchorTag,
    },
  }).trim();
}

function sanitizePageBlockContent(type: string, content: unknown): unknown {
  if (!content || typeof content !== 'object') {
    return content;
  }

  if (type === 'TEXT') {
    const next = content as Record<string, unknown>;
    return {
      ...next,
      text: sanitizeRichHtml(typeof next.text === 'string' ? next.text : ''),
    };
  }

  if (type === 'SECTION') {
    const next = content as Record<string, unknown>;
    const rawColumns = Array.isArray(next.columns) ? next.columns : [];

    return {
      ...next,
      columns: rawColumns.map((column) => {
        if (!column || typeof column !== 'object') return column;

        const columnRecord = column as Record<string, unknown>;
        const rawWidgets = Array.isArray(columnRecord.widgets) ? columnRecord.widgets : [];

        return {
          ...columnRecord,
          widgets: rawWidgets.map((widget) => sanitizeBlockPayload(widget)),
        };
      }),
    };
  }

  return content;
}

export function sanitizeBlockPayload<T extends { type?: unknown; content?: unknown }>(block: T): T {
  if (!block || typeof block !== 'object') {
    return block;
  }

  const blockType = typeof block.type === 'string' ? block.type : '';
  const rawContent = block.content;

  if (typeof rawContent === 'string') {
    try {
      const parsed = JSON.parse(rawContent);
      const sanitized = sanitizePageBlockContent(blockType, parsed);
      return {
        ...block,
        content: JSON.stringify(sanitized),
      };
    } catch {
      return block;
    }
  }

  return {
    ...block,
    content: sanitizePageBlockContent(blockType, rawContent),
  };
}

export function sanitizePageBlocks<T extends { type?: unknown; content?: unknown }>(blocks: T[] | null | undefined): T[] {
  if (!Array.isArray(blocks)) {
    return [];
  }

  return blocks.map((block) => sanitizeBlockPayload(block));
}
