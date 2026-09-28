/**
 * Turns a long-text field (a description, notes) into display HTML for the
 * record view's `markdown` field type.
 *
 * Such text arrives in two shapes: HTML written in the rich-text editor, and raw
 * GitHub-flavoured markdown (e.g. task descriptions synced from issues / pull
 * requests). Bound as-is
 * through `[innerHTML]`, the markdown collapsed into one run-on paragraph — no
 * line breaks, headings, lists or code. This renders the common GFM subset.
 *
 * Safety: every piece of source text is HTML-escaped BEFORE any markup is added,
 * and link / image URLs are limited to http(s), mailto and relative targets, so
 * the output only ever contains tags this file emits. Angular's sanitizer still
 * runs on the `[innerHTML]` binding on top of that.
 */

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

const LIST_ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const FENCE = /^\s{0,3}(`{3,}|~{3,})\s*([\w+#.-]*)/;
const REFERENCE_DEFINITION = /^\s{0,3}\[([^\]]+)\]:\s*(\S+)(?:\s+.*)?$/;
const DETAILS_OPEN = /^\s*<details\b[^>]*>/i;
/** GitHub alert syntax: `> [!NOTE]` as the first line of a quote. */
const ALERT = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i;
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const QUOTE = /^\s{0,3}>/;
const SETEXT = /^\s{0,3}(=+|-+)\s*$/;
const TABLE_DIVIDER = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)+\|?\s*$/;

/** "EEA & UK Tenant Restrictions: Automatically blocks …" — a short label, then prose. */
const LABEL_LINE = /^([A-Za-z][^:/`*<>]{1,50}?):\s+(\S.*)$/;

/**
 * Inline HTML that GitHub bodies commonly carry (bot summaries, badges). These
 * are rebuilt from scratch with no attributes; `a` and `img` keep only a vetted
 * URL (and alt text). Every other tag is dropped and its text kept.
 */
const INLINE_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'del', 'sup', 'sub', 'small', 'mark', 'kbd', 'code', 'br', 'summary', 'details']);
/** Structural tags allowed through, likewise rebuilt without attributes. */
const BLOCK_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'hr', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'dl', 'dt', 'dd']);
/**
 * GFM's HTML-block rule: a line opening with a block-level tag starts raw HTML
 * that runs to the next blank line (Dependabot release notes are all this).
 */
const HTML_BLOCK = /^\s{0,3}<\/?(p|h[1-6]|ul|ol|li|blockquote|pre|hr|table|thead|tbody|tfoot|tr|th|td|dl|dt|dd|div|section|article|figure)\b/i;
const RAW_TAG = /<(\/?)([a-z][a-z0-9]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi;
const ATTRIBUTE = /([a-z][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;

const RICH_TEXT_START = /^<(p|div|h[1-6]|ul|ol|table|blockquote|pre|figure|span|br|strong|em|b|i|a)(\s[^>]*)?\/?>/i;
/** Tags the rich-text editor wraps plain pasted text in — nothing structural. */
const TRIVIAL_TAG = /^<\/?(p|br|div|span)(\s[^>]*)?\/?>$/i;
const ANY_TAG = /<\/?[a-z][a-z0-9]*(\s[^>]*)?\/?>/gi;
const MARKDOWN_HINT = /(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|\d+[.)]\s|>|```)|\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)/;

export function richTextToHtml(source: string | null | undefined): string {
	if (!source || !source.trim()) {
		return '';
	}

	// Editor output always opens with a block element. Markdown may carry the odd
	// inline tag (`<b>`, `<img>`, `<details>`) but does not start with one.
	if (!RICH_TEXT_START.test(source.replace(/<!--[\s\S]*?-->/g, '').trim())) {
		return markdownToHtml(source);
	}

	// Markdown that went through the editor comes back as `<p>` / `<br>` around
	// the raw syntax. Unwrap it and render it; real rich text is left alone.
	const tags = source.match(ANY_TAG) || [];
	if (tags.every((tag) => TRIVIAL_TAG.test(tag))) {
		const text = decodeEntities(
			source
				.replace(/<br\s*\/?>/gi, '\n')
				.replace(/<\/(p|div)>\s*/gi, '\n\n')
				.replace(ANY_TAG, '')
		);
		if (MARKDOWN_HINT.test(text)) {
			return markdownToHtml(text);
		}
	}
	return source;
}

/** Link targets from `[label]: url` definitions, for `[text][label]` references in the current render. */
let references = new Map<string, string>();

export function markdownToHtml(source: string): string {
	references = new Map();
	const lines = source
		.replace(/\r\n?/g, '\n')
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, '')
		.split('\n')
		// `[label]: url` lines are definitions, never content — including the
		// `[//]: # (comment)` idiom bots use as invisible markers.
		.filter((line) => {
			const definition = line.match(REFERENCE_DEFINITION);
			if (definition) {
				references.set(definition[1].toLowerCase(), definition[2]);
			}
			return !definition;
		});
	return renderBlocks(lines);
}

function renderBlocks(lines: string[]): string {
	const html: string[] = [];
	let i = 0;

	while (i < lines.length) {
		const line = lines[i];

		// Blank lines, and the lone `<br />` spacers GitHub bodies are full of.
		if (!line.trim() || /^\s*<br\s*\/?>\s*$/i.test(line)) {
			i++;
			continue;
		}

		const fence = line.match(FENCE);
		if (fence) {
			const body: string[] = [];
			i++;
			while (i < lines.length && !lines[i].trim().startsWith(fence[1])) {
				body.push(lines[i++]);
			}
			i++; // closing fence
			html.push(renderCodeBlock(body, fence[2]));
			continue;
		}

		if (DETAILS_OPEN.test(line)) {
			i = renderDetails(lines, i, html);
			continue;
		}

		if (HTML_BLOCK.test(line)) {
			const body: string[] = [];
			while (i < lines.length && lines[i].trim()) {
				body.push(lines[i++]);
			}
			html.push(renderInline(body.join('\n')));
			continue;
		}

		const heading = line.match(HEADING);
		if (heading) {
			const level = heading[1].length;
			html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
			i++;
			continue;
		}

		if (RULE.test(line)) {
			html.push('<hr />');
			i++;
			continue;
		}

		if (QUOTE.test(line)) {
			const body: string[] = [];
			while (i < lines.length && QUOTE.test(lines[i])) {
				body.push(lines[i++].replace(/^\s{0,3}>\s?/, ''));
			}
			const alert = body[0]?.trim().match(ALERT);
			if (alert) {
				const kind = alert[1].toLowerCase();
				const title = kind.charAt(0).toUpperCase() + kind.slice(1);
				html.push(
					`<div class="md-alert md-alert-${kind}"><p class="md-alert-title">${title}</p>${renderBlocks(body.slice(1))}</div>`
				);
			} else {
				html.push(`<blockquote>${renderBlocks(body)}</blockquote>`);
			}
			continue;
		}

		if (isTableStart(lines, i)) {
			i = renderTable(lines, i, html);
			continue;
		}

		if (LIST_ITEM.test(line)) {
			const [list, next] = renderList(lines, i);
			html.push(list);
			i = next;
			continue;
		}

		// "Title\n=====" / "Title\n-----"
		if (i + 1 < lines.length && SETEXT.test(lines[i + 1])) {
			const level = lines[i + 1].trim().startsWith('=') ? 1 : 2;
			html.push(`<h${level}>${renderInline(line.trim())}</h${level}>`);
			i += 2;
			continue;
		}

		// Paragraph: runs until a blank line or the start of another block. Single
		// newlines are kept as line breaks, the way GitHub renders issue bodies.
		const body: string[] = [];
		do {
			body.push(lines[i++].trim());
		} while (i < lines.length && lines[i].trim() && !startsBlock(lines, i));
		renderParagraph(body, html);
	}

	return html.join('');
}

/**
 * Plain-text descriptions (written without any markdown) still carry an
 * implicit structure: a short title line opening a block, and runs of
 * "Label: explanation" lines. Both are given their visual form here, so such
 * a body reads like a structured issue rather than a wall of text.
 */
function renderParagraph(body: string[], html: string[]): void {
	let lines = body;

	if (lines.length > 1 && isTitleLine(lines[0])) {
		html.push(`<h4 class="md-lead">${renderInline(lines[0])}</h4>`);
		lines = lines.slice(1);
	}

	const labelled = lines.map((line) => line.match(LABEL_LINE));
	if (lines.length > 1 && labelled.every(Boolean)) {
		const items = labelled
			.map((match) => `<li><strong>${renderInline(match[1])}:</strong> ${renderInline(match[2])}</li>`)
			.join('');
		html.push(`<ul class="md-labelled">${items}</ul>`);
		return;
	}

	html.push(`<p>${lines.map(renderInline).join('<br />')}</p>`);
}

/** A short capitalised line with no sentence punctuation — "Overview", "Key Changes". */
function isTitleLine(line: string): boolean {
	return (
		line.length <= 48 &&
		/^[A-Z]/.test(line) &&
		!/[.,;:!?`<>|*_[\]()]/.test(line) &&
		line.split(/\s+/).length <= 6
	);
}

/**
 * A fenced code block, with its language as a small header. `diff` blocks get
 * their added / removed lines tinted.
 */
function renderCodeBlock(body: string[], language: string): string {
	const lang = (language || '').toLowerCase();
	const code =
		lang === 'diff'
			? body
					.map((line) => {
						const kind = line.startsWith('+') ? 'md-add' : line.startsWith('-') ? 'md-del' : null;
						return kind ? `<span class="${kind}">${escapeHtml(line)}</span>` : escapeHtml(line);
					})
					.join('\n')
			: escapeHtml(body.join('\n'));
	const header = lang ? `<div class="md-code-lang">${escapeHtml(lang)}</div>` : '';
	return `<div class="md-code">${header}<pre><code>${code}</code></pre></div>`;
}

/**
 * `<details><summary>…</summary> markdown… </details>` — the collapsible
 * section GitHub bodies use for long bot output. The body is markdown in its
 * own right, so it is rendered recursively. Returns the index after the block.
 */
function renderDetails(lines: string[], start: number, html: string[]): number {
	const collected: string[] = [];
	let depth = 0;
	let i = start;
	while (i < lines.length) {
		const line = lines[i++];
		depth += (line.match(/<details\b/gi) || []).length;
		depth -= (line.match(/<\/details>/gi) || []).length;
		collected.push(line);
		if (depth <= 0) {
			break;
		}
	}

	let inner = collected.join('\n').replace(DETAILS_OPEN, '').replace(/<\/details>\s*$/i, '');
	let summary = '';
	inner = inner.replace(/<summary\b[^>]*>([\s\S]*?)<\/summary>/i, (_, text) => {
		summary = text.trim();
		return '';
	});
	// A `<br>` straight after the summary is only there for GitHub's own spacing.
	inner = inner.replace(/^\s*<br\s*\/?>/i, '');

	html.push(
		`<details class="md-details"><summary>${renderInline(summary || 'Details')}</summary>` +
			`<div class="md-details-body">${renderBlocks(inner.split('\n'))}</div></details>`
	);
	return i;
}

function startsBlock(lines: string[], i: number): boolean {
	const line = lines[i];
	return (
		FENCE.test(line) ||
		DETAILS_OPEN.test(line) ||
		HTML_BLOCK.test(line) ||
		HEADING.test(line) ||
		RULE.test(line) ||
		QUOTE.test(line) ||
		LIST_ITEM.test(line) ||
		isTableStart(lines, i)
	);
}

interface ListItem {
	text: string[];
	children: string;
}

/** Renders one list (and, recursively, the lists nested in it). Returns the index after it. */
function renderList(lines: string[], start: number): [string, number] {
	const first = lines[start].match(LIST_ITEM);
	const indent = first[1].length;
	const ordered = /\d/.test(first[2]);
	const items: ListItem[] = [];
	let i = start;

	while (i < lines.length) {
		const line = lines[i];
		const match = line.match(LIST_ITEM);
		const current = items[items.length - 1];

		if (!match) {
			if (!line.trim()) {
				// A blank line only ends the list if what follows is not another item of it.
				let j = i + 1;
				while (j < lines.length && !lines[j].trim()) j++;
				const next = j < lines.length ? lines[j].match(LIST_ITEM) : null;
				if (next && next[1].length >= indent) {
					i = j;
					continue;
				}
				break;
			}
			// Lazy continuation of the current item's text.
			if (current && !startsBlock(lines, i)) {
				current.text.push(line.trim());
				i++;
				continue;
			}
			break;
		}

		if (match[1].length < indent) {
			break;
		}
		if (match[1].length > indent && current) {
			const [nested, next] = renderList(lines, i);
			current.children += nested;
			i = next;
			continue;
		}
		if (/\d/.test(match[2]) !== ordered) {
			break;
		}

		items.push({ text: [match[3]], children: '' });
		i++;
	}

	const tag = ordered ? 'ol' : 'ul';
	const startNumber = ordered ? parseInt(first[2], 10) : 1;
	const open = ordered && startNumber !== 1 ? `<ol start="${startNumber}">` : `<${tag}>`;
	const body = items
		.map(({ text, children }) => {
			let content = text.map(renderInline).join('<br />');
			const task = text[0].match(/^\[( |x|X)\]\s+/);
			if (task) {
				const checked = task[1] !== ' ';
				content = `<span class="md-check${checked ? ' is-checked' : ''}">${checked ? '&#10003;' : ''}</span>${content.replace(/^\[( |x|X)\]\s+/, '')}`;
			}
			return `<li${task ? ' class="md-task"' : ''}>${content}${children}</li>`;
		})
		.join('');

	return [`${open}${body}</${tag}>`, i];
}

function isTableStart(lines: string[], i: number): boolean {
	return lines[i].includes('|') && i + 1 < lines.length && TABLE_DIVIDER.test(lines[i + 1]);
}

function renderTable(lines: string[], start: number, html: string[]): number {
	const header = splitRow(lines[start]);
	let i = start + 2;
	const rows: string[][] = [];
	while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
		rows.push(splitRow(lines[i++]));
	}

	const head = header.map((cell) => `<th>${renderInline(cell)}</th>`).join('');
	const body = rows
		.map((row) => `<tr>${header.map((_, c) => `<td>${renderInline(row[c] ?? '')}</td>`).join('')}</tr>`)
		.join('');
	html.push(`<div class="md-table"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`);
	return i;
}

function splitRow(line: string): string[] {
	return line
		.trim()
		.replace(/^\|/, '')
		.replace(/\|$/, '')
		.split('|')
		.map((cell) => cell.trim());
}

/**
 * Inline markup. Code spans and links are swapped out for placeholders first so
 * that emphasis and autolinking never reach inside them.
 */
function renderInline(text: string): string {
	const stash: string[] = [];
	const keep = (html: string) => `\u0000${stash.push(html) - 1}\u0000`;

	// Code spans first, on the raw text, so a tag inside backticks stays literal.
	let out = text.replace(/`([^`]+)`/g, (_, code) => keep(`<code>${escapeHtml(code)}</code>`));
	out = out.replace(RAW_TAG, (_, closing, name, attrs) => keep(rebuildTag(name.toLowerCase(), !!closing, attrs)));
	out = escapeHtml(out);

	out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;.*?&quot;)?\)/g, (match, alt, url) => {
		const href = safeUrl(url);
		return href ? keep(`<img src="${href}" alt="${alt}" />`) : match;
	});

	out = out.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;.*?&quot;)?\)/g, (match, label, url) => {
		const href = safeUrl(url);
		return href ? keep(`<a href="${href}" target="_blank" rel="noopener noreferrer">${emphasis(label)}</a>`) : match;
	});

	// `[text][ref]` / `[text][]` against the definitions collected up front.
	out = out.replace(/\[([^\]]+)\]\[([^\]]*)\]/g, (match, label, ref) => {
		const target = references.get((ref || label).toLowerCase());
		const href = target ? safeUrl(escapeHtml(target)) : null;
		return href ? keep(`<a href="${href}" target="_blank" rel="noopener noreferrer">${emphasis(label)}</a>`) : match;
	});

	out = out.replace(
		/(^|[\s(])(https?:\/\/[^\s<\u0000]*[^\s<\u0000.,:;!?'")\]])/g,
		(_, before, url) => before + keep(`<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`)
	);

	out = emphasis(out);

	// Placeholders can nest (a code span inside a link label), so restore until none are left.
	const placeholder = /\u0000(\d+)\u0000/g;
	while (placeholder.test(out)) {
		out = out.replace(placeholder, (_, index) => stash[+index]);
	}
	return out;
}

function emphasis(text: string): string {
	return text
		.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
		.replace(/(^|[^\w])__(?=\S)([\s\S]*?\S)__(?!\w)/g, '$1<strong>$2</strong>')
		.replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>')
		.replace(/(^|[^\w*])\*(?=[^\s*])([^*]*?[^\s*])?\*(?![\w*])/g, (match, before, body) =>
			body === undefined ? match : `${before}<em>${body}</em>`
		)
		.replace(/(^|[^\w])_(?=[^\s_])([^_]*?[^\s_])?_(?!\w)/g, (match, before, body) =>
			body === undefined ? match : `${before}<em>${body}</em>`
		);
}

/**
 * Re-emits an allowed inline HTML tag without its original attributes; any
 * other tag becomes an empty string (its text content is left in place).
 */
function rebuildTag(name: string, closing: boolean, attrs: string): string {
	if (name === 'a') {
		if (closing) {
			return '</a>';
		}
		const href = safeUrl(escapeHtml(readAttribute(attrs, 'href') || ''));
		return href ? `<a href="${href}" target="_blank" rel="noopener noreferrer">` : '<a>';
	}
	if (name === 'img') {
		const src = safeUrl(escapeHtml(readAttribute(attrs, 'src') || ''));
		const alt = escapeHtml(readAttribute(attrs, 'alt') || '');
		return src ? `<img src="${src}" alt="${alt}" />` : '';
	}
	if (!INLINE_TAGS.has(name) && !BLOCK_TAGS.has(name)) {
		return '';
	}
	if (name === 'br' || name === 'hr') {
		return closing ? '' : `<${name} />`;
	}
	return closing ? `</${name}>` : `<${name}>`;
}

function readAttribute(attrs: string, wanted: string): string | null {
	for (const match of attrs.matchAll(ATTRIBUTE)) {
		if (match[1].toLowerCase() === wanted) {
			return match[2] ?? match[3] ?? match[4] ?? '';
		}
	}
	return null;
}

/** Runs on already-escaped text, so `&` in a query string reads `&amp;` — correct inside an attribute. */
function safeUrl(url: string): string | null {
	const value = url.trim();
	return /^(https?:\/\/|mailto:|\/|#|\.\/)/i.test(value) ? value : null;
}

function escapeHtml(text: string): string {
	return text.replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

function decodeEntities(text: string): string {
	return text
		.replace(/&nbsp;/g, ' ')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&');
}
