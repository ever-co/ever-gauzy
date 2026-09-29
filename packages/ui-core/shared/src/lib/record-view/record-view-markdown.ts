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

// Patterns avoid overlapping quantifiers (e.g. `\s+(.*)`), so matching stays linear.
const LIST_ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(\S.*)?$/;
const HEADING = /^\s{0,3}(#{1,6})\s+(\S.*)?$/;
const FENCE = /^\s{0,3}(`{3,}|~{3,})\s*([\w+#.-]*)/;
/** A closing fence: only the fence run, then whitespace. */
const FENCE_CLOSE = /^\s{0,3}(`+|~+)\s*$/;
const REFERENCE_DEFINITION = /^\s{0,3}\[([^\]]+)\]:\s*(\S+)(?:\s.*)?$/;
const DETAILS_OPEN = /^\s*<details\b[^>]*>/i;
/** GitHub alert syntax: `> [!NOTE]` as the first line of a quote. */
const ALERT = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i;
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const QUOTE = /^\s{0,3}>/;
const SETEXT = /^\s{0,3}(=+|-+)\s*$/;
/** One cell of a table's divider row: `---`, `:--`, `--:` or `:-:`. */
const DIVIDER_CELL = /^:?-+:?$/;

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
const HTML_BLOCK_TAGS = new Set([...BLOCK_TAGS, 'div', 'section', 'article', 'figure']);
/** The name of the tag a line opens with, e.g. `ul` for `  <ul>` or `</ul>`. */
const LEADING_TAG = /^\s{0,3}<\/?([a-z][a-z0-9]*)\b/i;
const RAW_TAG = /<(\/?)([a-z][a-z0-9]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi;
/** The attributes `rebuildTag` keeps, each matched only as a whole attribute name. */
const ATTRIBUTES: Record<string, RegExp> = {
	href: /(?:^|\s)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i,
	src: /(?:^|\s)src\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i,
	alt: /(?:^|\s)alt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i
};

/** Tags rich-text editor output opens with. */
const RICH_TEXT_TAGS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'table', 'blockquote', 'pre', 'figure', 'span', 'br', 'strong', 'em', 'b', 'i', 'a']);
/** The first tag of a string, when the string opens with a complete tag. */
const OPENING_TAG = /^<([a-z][a-z0-9]*)(?:\s[^>]*)?\/?>/i;
/** Tags the rich-text editor wraps plain pasted text in — nothing structural. */
const TRIVIAL_TAG = /^<\/?(p|br|div|span)(\s[^>]*)?\/?>$/i;
const ANY_TAG = /<\/?[a-z][a-z0-9]*(\s[^>]*)?\/?>/gi;
/** Any one of these in editor-unwrapped text means it was really markdown. */
const MARKDOWN_HINTS = [/^\s{0,3}(#{1,6}\s|[-*+]\s|\d+[.)]\s|>|```)/m, /\*\*[^*]+\*\*/, /`[^`]+`/, /\[[^\]]+\]\([^)]+\)/];

export function richTextToHtml(source: string | null | undefined): string {
	if (!source?.trim()) {
		return '';
	}

	// Editor output always opens with a block element. Markdown may carry the odd
	// inline tag (`<b>`, `<img>`, `<details>`) but does not start with one.
	if (!isRichText(source)) {
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
		if (MARKDOWN_HINTS.some((hint) => hint.test(text))) {
			return markdownToHtml(text);
		}
	}
	return source;
}

function isRichText(source: string): boolean {
	const tag = OPENING_TAG.exec(source.replace(/<!--[\s\S]*?-->/g, '').trim());
	return !!tag && RICH_TEXT_TAGS.has(tag[1].toLowerCase());
}

function isHtmlBlockStart(line: string): boolean {
	const tag = LEADING_TAG.exec(line);
	return !!tag && HTML_BLOCK_TAGS.has(tag[1].toLowerCase());
}

/** Link targets from `[label]: url` definitions, for `[text][label]` references in the current render. */
let references = new Map<string, string>();

export function markdownToHtml(source: string): string {
	references = new Map();
	return renderBlocks(removeNonContent(source.replace(/\r\n?/g, '\n').split('\n')));
}

/**
 * Drops what is never shown — HTML comments, `<script>` / `<style>` blocks and
 * `[label]: url` definitions — from the prose only. Fenced code is copied
 * through untouched: a `<script>` or `<!-- -->` inside a code example is
 * content, and `renderCodeBlock` escapes it.
 */
function removeNonContent(lines: string[]): string[] {
	const out: string[] = [];
	let prose: string[] = [];
	let i = 0;
	while (i < lines.length) {
		const fence = FENCE.exec(lines[i]);
		if (fence) {
			out.push(...cleanProse(prose));
			prose = [];
			i = copyFence(lines, i, fence[1], out);
		} else {
			prose.push(lines[i++]);
		}
	}
	out.push(...cleanProse(prose));
	return out;
}

/** Copies a fenced block, fences included, and returns the index after it. */
function copyFence(lines: string[], start: number, marker: string, out: string[]): number {
	const end = closingFenceIndex(lines, start, marker);
	out.push(...lines.slice(start, end + 1));
	return end + 1;
}

/**
 * Index of the line that closes the fence opened at `start` — or `lines.length`
 * when it never closes (the block then runs to the end, as on GitHub).
 */
function closingFenceIndex(lines: string[], start: number, marker: string): number {
	let i = start + 1;
	while (i < lines.length && !isClosingFence(lines[i], marker)) {
		i++;
	}
	return i;
}

/**
 * A line closes a fence only if it is nothing but a run of the opener's
 * character at least as long as the opener — so a ```` ```js ```` line inside a
 * ```` ``` ```` block is content, not the end of it.
 */
function isClosingFence(line: string, marker: string): boolean {
	const fence = FENCE_CLOSE.exec(line);
	return !!fence && fence[1][0] === marker[0] && fence[1].length >= marker.length;
}

function cleanProse(lines: string[]): string[] {
	if (!lines.length) {
		return [];
	}
	return (
		lines
			.join('\n')
			.replace(/<!--[\s\S]*?-->/g, '')
			.replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, '')
			.split('\n')
			// `[label]: url` lines are definitions, never content — including the
			// `[//]: # (comment)` idiom bots use as invisible markers.
			.filter((line) => {
				const definition = REFERENCE_DEFINITION.exec(line);
				if (definition) {
					references.set(definition[1].toLowerCase(), definition[2]);
				}
				return !definition;
			})
	);
}

/**
 * A block renderer looks at the line at `i`. If that line starts its kind of
 * block, it appends the HTML and returns the index after the block; otherwise
 * it returns `NO_MATCH` and the next renderer is tried.
 */
type BlockRenderer = (lines: string[], i: number, html: string[]) => number;

const NO_MATCH = -1;

/** The lone `<br />` spacers GitHub bodies are full of. */
const SPACER = /^\s*<br\s*\/?>\s*$/i;

function renderBlocks(lines: string[]): string {
	const html: string[] = [];
	let i = 0;
	while (i < lines.length) {
		i = isSpacer(lines[i]) ? i + 1 : renderBlock(lines, i, html);
	}
	return html.join('');
}

function isSpacer(line: string): boolean {
	return !line.trim() || SPACER.test(line);
}

/** Tried in order — the precedence GitHub applies when a line could open several blocks. */
const BLOCK_RENDERERS: BlockRenderer[] = [
	renderFenceBlock,
	renderDetailsBlock,
	renderHtmlBlock,
	renderHeadingBlock,
	renderRuleBlock,
	renderQuoteBlock,
	renderTableBlock,
	renderListBlock,
	renderSetextBlock
];

/** Renders the block starting at `i`; a paragraph when nothing more specific matches. */
function renderBlock(lines: string[], i: number, html: string[]): number {
	for (const render of BLOCK_RENDERERS) {
		const next = render(lines, i, html);
		if (next !== NO_MATCH) {
			return next;
		}
	}
	return renderParagraphBlock(lines, i, html);
}

function renderFenceBlock(lines: string[], i: number, html: string[]): number {
	const fence = FENCE.exec(lines[i]);
	if (!fence) {
		return NO_MATCH;
	}
	const end = closingFenceIndex(lines, i, fence[1]);
	html.push(renderCodeBlock(lines.slice(i + 1, end), fence[2]));
	return end + 1; // past the closing fence
}

function renderDetailsBlock(lines: string[], i: number, html: string[]): number {
	return DETAILS_OPEN.test(lines[i]) ? renderDetails(lines, i, html) : NO_MATCH;
}

/** Raw block-level HTML runs to the next blank line (GFM's HTML-block rule). */
function renderHtmlBlock(lines: string[], i: number, html: string[]): number {
	if (!isHtmlBlockStart(lines[i])) {
		return NO_MATCH;
	}
	const next = nextBlankLine(lines, i);
	html.push(renderInline(lines.slice(i, next).join('\n')));
	return next;
}

function nextBlankLine(lines: string[], from: number): number {
	let next = from;
	while (next < lines.length && lines[next].trim()) {
		next++;
	}
	return next;
}

function renderHeadingBlock(lines: string[], i: number, html: string[]): number {
	const heading = HEADING.exec(lines[i]);
	if (!heading) {
		return NO_MATCH;
	}
	const level = heading[1].length;
	html.push(`<h${level}>${renderInline(stripClosingHashes(heading[2] ?? ''))}</h${level}>`);
	return i + 1;
}

/** `## Title ##` — the optional closing run of `#` is not part of the title. */
function stripClosingHashes(text: string): string {
	let end = text.trimEnd();
	while (end.endsWith('#')) {
		end = end.slice(0, -1);
	}
	return end.trimEnd();
}

function renderRuleBlock(lines: string[], i: number, html: string[]): number {
	if (!RULE.test(lines[i])) {
		return NO_MATCH;
	}
	html.push('<hr />');
	return i + 1;
}

/** A quote — or, when its first line is `[!NOTE]` & co., an alert panel. */
function renderQuoteBlock(lines: string[], i: number, html: string[]): number {
	if (!QUOTE.test(lines[i])) {
		return NO_MATCH;
	}
	const body: string[] = [];
	let next = i;
	while (next < lines.length && QUOTE.test(lines[next])) {
		body.push(lines[next++].replace(/^\s{0,3}>\s?/, ''));
	}
	const alert = ALERT.exec(body[0]?.trim() ?? '');
	if (alert) {
		const kind = alert[1].toLowerCase();
		const title = kind.charAt(0).toUpperCase() + kind.slice(1);
		html.push(
			`<div class="md-alert md-alert-${kind}"><p class="md-alert-title">${title}</p>${renderBlocks(body.slice(1))}</div>`
		);
	} else {
		html.push(`<blockquote>${renderBlocks(body)}</blockquote>`);
	}
	return next;
}

function renderTableBlock(lines: string[], i: number, html: string[]): number {
	return isTableStart(lines, i) ? renderTable(lines, i, html) : NO_MATCH;
}

function renderListBlock(lines: string[], i: number, html: string[]): number {
	if (!LIST_ITEM.test(lines[i])) {
		return NO_MATCH;
	}
	const [list, next] = renderList(lines, i);
	html.push(list);
	return next;
}

/** "Title\n=====" / "Title\n-----" */
function renderSetextBlock(lines: string[], i: number, html: string[]): number {
	if (i + 1 >= lines.length || !SETEXT.test(lines[i + 1])) {
		return NO_MATCH;
	}
	const level = lines[i + 1].trim().startsWith('=') ? 1 : 2;
	html.push(`<h${level}>${renderInline(lines[i].trim())}</h${level}>`);
	return i + 2;
}

/**
 * Paragraph: runs until a blank line or the start of another block. Single
 * newlines are kept as line breaks, the way GitHub renders issue bodies.
 */
function renderParagraphBlock(lines: string[], i: number, html: string[]): number {
	const body: string[] = [];
	let next = i;
	do {
		body.push(lines[next++].trim());
	} while (next < lines.length && lines[next].trim() && !startsBlock(lines, next));
	renderParagraph(body, html);
	return next;
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

	const labelled = lines.map((line) => LABEL_LINE.exec(line));
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
	const code = lang === 'diff' ? body.map(renderDiffLine).join('\n') : escapeHtml(body.join('\n'));
	const header = lang ? `<div class="md-code-lang">${escapeHtml(lang)}</div>` : '';
	return `<div class="md-code">${header}<pre><code>${code}</code></pre></div>`;
}

/** A `diff` line, tinted when it adds (`+`) or removes (`-`). */
function renderDiffLine(line: string): string {
	let kind: string = null;
	if (line.startsWith('+')) {
		kind = 'md-add';
	} else if (line.startsWith('-')) {
		kind = 'md-del';
	}
	return kind ? `<span class="${kind}">${escapeHtml(line)}</span>` : escapeHtml(line);
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
		isHtmlBlockStart(line) ||
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

/** One list being parsed: its marker indent, its kind, and the items read so far. */
interface ListState {
	indent: number;
	ordered: boolean;
	items: ListItem[];
}

/** Returned by a list step when the line at hand ends the list. */
const LIST_END = -1;

const TASK_MARKER = /^\[([ xX])\]\s+/;

/** Renders one list (and, recursively, the lists nested in it). Returns the index after it. */
function renderList(lines: string[], start: number): [string, number] {
	const first = LIST_ITEM.exec(lines[start]);
	const list: ListState = { indent: first[1].length, ordered: isOrderedMarker(first[2]), items: [] };
	let i = start;
	while (i < lines.length) {
		const next = listStep(lines, i, list);
		if (next === LIST_END) {
			break;
		}
		i = next;
	}
	return [renderListHtml(list, first[2]), i];
}

function isOrderedMarker(marker: string): boolean {
	return /\d/.test(marker);
}

/** Consumes the line at `i` into the list; returns where to continue, or `LIST_END`. */
function listStep(lines: string[], i: number, list: ListState): number {
	const match = LIST_ITEM.exec(lines[i]);
	return match ? listItemStep(lines, i, match, list) : listTextStep(lines, i, list);
}

/** A line that is not an item: a blank line, or lazy continuation text of the current item. */
function listTextStep(lines: string[], i: number, list: ListState): number {
	if (!lines[i].trim()) {
		return itemAfterBlankLines(lines, i, list.indent);
	}
	const current = list.items.at(-1);
	if (current && !startsBlock(lines, i)) {
		current.text.push(lines[i].trim());
		return i + 1;
	}
	return LIST_END;
}

/** A blank line only ends the list if what follows is not another item of it. */
function itemAfterBlankLines(lines: string[], i: number, indent: number): number {
	let next = i + 1;
	while (next < lines.length && !lines[next].trim()) {
		next++;
	}
	const item = next < lines.length ? LIST_ITEM.exec(lines[next]) : null;
	return item && item[1].length >= indent ? next : LIST_END;
}

/** An item line: a sibling, a nested list under the current item, or the end of this list. */
function listItemStep(lines: string[], i: number, match: RegExpMatchArray, list: ListState): number {
	const indent = match[1].length;
	const current = list.items.at(-1);
	if (indent < list.indent) {
		return LIST_END;
	}
	if (indent > list.indent && current) {
		const [nested, next] = renderList(lines, i);
		current.children += nested;
		return next;
	}
	if (isOrderedMarker(match[2]) !== list.ordered) {
		return LIST_END;
	}
	list.items.push({ text: [match[3] ?? ''], children: '' });
	return i + 1;
}

function renderListHtml(list: ListState, firstMarker: string): string {
	const tag = list.ordered ? 'ol' : 'ul';
	const startNumber = list.ordered ? Number.parseInt(firstMarker, 10) : 1;
	const open = list.ordered && startNumber !== 1 ? `<ol start="${startNumber}">` : `<${tag}>`;
	return `${open}${list.items.map(renderListItem).join('')}</${tag}>`;
}

/** An item, with a `[ ]` / `[x]` task marker drawn as a checkbox. */
function renderListItem({ text, children }: ListItem): string {
	const content = text.map(renderInline).join('<br />');
	const task = TASK_MARKER.exec(text[0]);
	if (!task) {
		return `<li>${content}${children}</li>`;
	}
	const checked = task[1] !== ' ';
	const box = `<span class="md-check${checked ? ' is-checked' : ''}">${checked ? '&#10003;' : ''}</span>`;
	return `<li class="md-task">${box}${content.replace(TASK_MARKER, '')}${children}</li>`;
}

function isTableStart(lines: string[], i: number): boolean {
	return lines[i].includes('|') && i + 1 < lines.length && isTableDivider(lines[i + 1]);
}

/** `---|:--:` — at least two cells, each only dashes with optional alignment colons. */
function isTableDivider(line: string): boolean {
	const cells = splitRow(line);
	return cells.length >= 2 && cells.every((cell) => DIVIDER_CELL.test(cell));
}

function renderTable(lines: string[], start: number, html: string[]): number {
	const header = splitRow(lines[start]);
	let i = start + 2;
	const rows: string[][] = [];
	while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
		rows.push(splitRow(lines[i++]));
	}

	const head = header.map((cell) => `<th>${renderInline(cell)}</th>`).join('');
	const body = rows.map((row) => renderTableRow(row, header.length)).join('');
	html.push(`<div class="md-table"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`);
	return i;
}

/** A body row, padded or cut to the header's column count. */
function renderTableRow(row: string[], columns: number): string {
	const cells = Array.from({ length: columns }, (_, c) => `<td>${renderInline(row[c] ?? '')}</td>`);
	return `<tr>${cells.join('')}</tr>`;
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
 * Brackets an index into `renderInline`'s stash. A private-use character, so
 * real text never contains it and it is not a control character.
 */
const MARK = '';
const PLACEHOLDER = new RegExp(`${MARK}(\\d+)${MARK}`, 'g');
/** Non-global twin of `PLACEHOLDER` for `.test()`, which is stateful on a global regex. */
const HAS_PLACEHOLDER = new RegExp(`${MARK}\\d+${MARK}`);
const AUTOLINK = new RegExp(`(^|[\\s(])(https?://[^\\s<${MARK}]*[^\\s<${MARK}.,:;!?'")\\]])`, 'g');

/**
 * Inline markup. Code spans and links are swapped out for placeholders first so
 * that emphasis and autolinking never reach inside them.
 */
function renderInline(text: string): string {
	const stash: string[] = [];
	const keep = (html: string) => `${MARK}${stash.push(html) - 1}${MARK}`;

	// Code spans first, on the raw text, so a tag inside backticks stays literal.
	let out = text.replace(/`([^`]+)`/g, (_, code) => keep(`<code>${escapeHtml(code)}</code>`));
	out = out.replace(RAW_TAG, (_, closing, name, attrs) => keep(rebuildTag(name.toLowerCase(), !!closing, attrs)));
	out = escapeHtml(out);

	// Labels exclude `[` as well as `]`, and titles stop at the first `&`, so no
	// pattern can rescan a run of brackets or text from every start position.
	out = out.replace(/!\[([^[\]]*)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (match, alt, url) => {
		const href = safeUrl(url);
		return href ? keep(`<img src="${href}" alt="${alt}" />`) : match;
	});

	out = out.replace(/\[([^[\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (match, label, url) => {
		const href = safeUrl(url);
		return href ? keep(`<a href="${href}" target="_blank" rel="noopener noreferrer">${emphasis(label)}</a>`) : match;
	});

	// `[text][ref]` / `[text][]` against the definitions collected up front.
	out = out.replace(/\[([^[\]]+)\]\[([^[\]]*)\]/g, (match, label, ref) => {
		const target = references.get((ref || label).toLowerCase());
		const href = target ? safeUrl(escapeHtml(target)) : null;
		return href ? keep(`<a href="${href}" target="_blank" rel="noopener noreferrer">${emphasis(label)}</a>`) : match;
	});

	out = out.replace(
		AUTOLINK,
		(_, before, url) => before + keep(`<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`)
	);

	out = emphasis(out);

	// Placeholders can nest (a code span inside a link label), so restore until none are left.
	while (HAS_PLACEHOLDER.test(out)) {
		out = out.replace(PLACEHOLDER, (_, index) => stash[+index]);
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

function readAttribute(attrs: string, wanted: 'href' | 'src' | 'alt'): string | null {
	const match = ATTRIBUTES[wanted].exec(attrs);
	return match ? match[1] ?? match[2] ?? match[3] ?? '' : null;
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
		.replaceAll('&nbsp;', ' ')
		.replaceAll('&lt;', '<')
		.replaceAll('&gt;', '>')
		.replaceAll('&quot;', '"')
		.replaceAll('&#39;', "'")
		.replaceAll('&amp;', '&');
}
