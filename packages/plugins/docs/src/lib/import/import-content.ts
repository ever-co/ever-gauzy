// cspell:ignore gzimport createdat
import * as sanitizeHtml from 'sanitize-html';
import { DocumentImportLayoutEnum } from '@gauzy/contracts';
import { createTurndown } from '../knowledge/extraction/html.extractor';
import { IDocMark, IDocNode, markdownToDocument } from '../services/document-markdown';
import { validateTiptapDocument } from '../validation/tiptap-schema.validator';
import { ImportLinkIndex, ImportPageFormat, IImportLinkTarget } from './import-plan';

/** The export metadata of a page: what may replace the name from the file, its emoji icon, its created date. */
export interface IImportPageMeta {
	title?: string;
	icon?: string;
	createdAt?: Date;
}

/** A page file read for the import: its metadata and its body as Markdown. */
export interface IImportPageSource {
	meta: IImportPageMeta;
	markdown: string;
}

/** What a link of a page resolves to, once the import created its target. */
export interface IImportResolvedTarget {
	documentId: string;
	/** The target's name in Docs (a page mention's label when the link has no text of its own). */
	name: string;
	/** For an attachment: its stored type and size (an image is shown inline, any other file as a card). */
	mimeType?: string | null;
	size?: number | null;
}

/** The inputs of one page's conversion. */
export interface IImportConvertInput {
	source: IImportPageSource;
	/** The page's name in Docs: a leading heading equal to it is not repeated in the body. */
	title: string;
	/** The page file's archive path (relative links resolve against its folder). */
	fromPath: string;
	links: ImportLinkIndex;
	/** The document the import created for a node key, or null when it created none (skipped, failed). */
	resolve: (target: IImportLinkTarget) => IImportResolvedTarget | null;
}

/** One page, converted. */
export interface IImportConvertResult {
	contentJson: IDocNode;
	/** Links and embeds that point at nothing the import created. */
	unresolvedLinks: number;
	/** The document ids of the pages the body mentions (for the `document → document` links). */
	mentionedDocumentIds: string[];
	/** True when the converted body failed the page schema and was stored as plain paragraphs instead. */
	schemaFallback: boolean;
}

/** The raw-file URL the editor stores for a file of Docs (`document-markdown.ts` reads it back). */
export const rawFileUrlOf = (documentId: string): string => `/api/plugins/docs/documents/${documentId}/raw`;

/** The internal schemes the wiki syntax is rewritten to before the Markdown is parsed. */
const WIKI_LINK_SCHEME = 'gzimport-wiki:';
const WIKI_EMBED_SCHEME = 'gzimport-embed:';

/** Link targets a page keeps as they are (`FR-8`); the schema's link allowlist. */
const KEPT_LINK_SCHEMES = /^(https?:|mailto:|tel:)/i;
/** Image sources a page keeps as they are: external images (the platform never fetches them on import). */
const KEPT_IMAGE_SCHEMES = /^https?:/i;

/** One emoji (with its modifiers and joiners), the only thing an icon may be. */
const EMOJI_ICON = /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:\u{FE0F}|\u{200D}|\u{20E3}|\p{Emoji_Modifier}|\p{Extended_Pictographic}|\p{Regional_Indicator})*$/u;

/** An icon as stored: one emoji, or nothing. */
export function emojiIconOf(value: unknown): string | undefined {
	const text = String(value ?? '').trim();
	return text && text.length <= 32 && EMOJI_ICON.test(text) ? text : undefined;
}

/** A date the export wrote (`2024-03-01`, `March 3, 2024 10:00 AM`, `@March 3, 2024`), or undefined. */
export function exportDateOf(value: unknown): Date | undefined {
	const text = String(value ?? '')
		.trim()
		.replace(/^@/, '')
		.replace(/^["']|["']$/g, '')
		.replace(/\s*\([^)]*\)\s*$/, '');
	if (!text) return undefined;
	const time = Date.parse(text);
	if (!Number.isFinite(time)) return undefined;
	const date = new Date(time);
	// A created date in the future, or before the web, is a misread.
	return date.getTime() > Date.now() + 86_400_000 || date.getUTCFullYear() < 1990 ? undefined : date;
}

const HTML_ENTITIES: Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

/** The text of an HTML fragment: tags out, entities decoded, whitespace collapsed. */
function htmlText(fragment: string): string {
	return fragment
		.replace(/<[^>]*>/g, ' ')
		.replace(/&(#\d{1,7}|#x[0-9a-f]{1,6}|[a-z]+|#39);/gi, (match, name: string) => {
			if (name[0] === '#') {
				const code = name[1].toLowerCase() === 'x' ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
				return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
			}
			return HTML_ENTITIES[name.toLowerCase()] ?? match;
		})
		.replace(/\s+/g, ' ')
		.trim();
}

// ---------------------------------------------------------------- reading a page file

/**
 * Reads YAML front matter (`---` … `---` at the very top): the simple `key: value` lines only (no nesting, no lists),
 * which is all the metadata an export writes there. Returns the metadata and the body after it.
 */
export function readFrontMatter(text: string): { fields: Record<string, string>; body: string } {
	const match = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(text);
	if (!match) return { fields: {}, body: text.replace(/^\uFEFF/, '') };
	const fields: Record<string, string> = {};
	for (const line of match[1].split(/\r?\n/)) {
		const field = /^([A-Za-z_][\w -]{0,40}):[ \t]*(.*)$/.exec(line);
		if (!field) continue;
		const value = field[2].trim().replace(/^(['"])(.*)\1$/, '$2');
		if (value) fields[field[1].trim().toLowerCase()] = value;
	}
	return { fields, body: text.slice(match[0].length) };
}

/** The properties an HTML export writes under the title of a database page, by name. */
const EXPORT_PROPERTY_NAME = /^(created( time| at| by)?|last edited( time| by)?|tags|status)$/i;

/**
 * A Markdown page file: front matter (`title`, `icon` / `emoji`, `created` / `created_at` / `date`) out of the body;
 * in an HTML export, the property lines under the leading title (`Created: March 3, 2024 10:00 AM`) too.
 */
export function readMarkdownPage(text: string, layout: DocumentImportLayoutEnum): IImportPageSource {
	const { fields, body } = readFrontMatter(String(text ?? '').replace(/\r\n?/g, '\n'));
	const meta: IImportPageMeta = {};
	if (fields['title']) meta.title = fields['title'].slice(0, 255);
	const icon = emojiIconOf(fields['icon'] ?? fields['emoji']);
	if (icon) meta.icon = icon;
	const created = exportDateOf(fields['created'] ?? fields['created_at'] ?? fields['createdat'] ?? fields['created time'] ?? fields['date']);
	if (created) meta.createdAt = created;

	let markdown = body;
	if (layout === DocumentImportLayoutEnum.HTML_EXPORT) {
		// The export's Markdown pages open with the full title (the file name is a shortened, id-suffixed copy of it).
		const heading = /^#[ \t]+([^\n]+?)[ \t#]*\n/.exec(markdown);
		if (heading && !meta.title) meta.title = heading[1].trim().slice(0, 255);
		// `# Title` then a block of `Key: value` property lines, then a blank line. The block is the export's only when it
		// names one of the export's own properties: a first paragraph such as `Goal: ship v2` is page text, and stays.
		const header = /^(#[ \t]+[^\n]+\n)\n?((?:[A-Za-z][\w ]{0,40}:[ \t]+[^\n]*\n)+)(?:\n|$)/.exec(markdown);
		const exportProperties = !!header && header[2].split('\n').some((line) => EXPORT_PROPERTY_NAME.test((/^([A-Za-z][\w ]{0,40}):/.exec(line)?.[1] ?? '').trim()));
		if (header && exportProperties) {
			for (const line of header[2].split('\n')) {
				const property = /^([A-Za-z][\w ]{0,40}):[ \t]+(.*)$/.exec(line);
				if (property && /^created( time| at)?$/i.test(property[1].trim()) && !meta.createdAt) {
					const date = exportDateOf(property[2]);
					if (date) meta.createdAt = date;
				}
			}
			markdown = `${header[1]}\n${markdown.slice(header[0].length)}`;
		}
	}
	return { meta, markdown };
}

/**
 * An HTML page file (`docs-import-export` spec FR-7, FR-10): the export header read for the title
 * (`h1.page-title`, else `<title>`), the emoji icon (`.page-header-icon`) and the created date (the properties
 * table), then the body — the page body, without the header — sanitized to an allowlist (no script, style, frame,
 * form, event handler or `data:` image) and turned into Markdown with the plugin's Turndown.
 */
export function readHtmlPage(html: string): IImportPageSource {
	const text = String(html ?? '');
	const meta: IImportPageMeta = {};
	const pageTitle = /<h1\b[^>]*class="[^"]*\bpage-title\b[^"]*"[^>]*>([\s\S]*?)<\/h1>/i.exec(text) ?? /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(text);
	const title = pageTitle ? htmlText(pageTitle[1]) : '';
	if (title) meta.title = title.slice(0, 255);
	const iconBlock = /<(?:div|span)\b[^>]*class="[^"]*\bpage-header-icon\b[^"]*"[^>]*>([\s\S]*?)<\/(?:div|span)>\s*(?:<\/div>)?/i.exec(text);
	const icon = iconBlock ? emojiIconOf(htmlText(iconBlock[1])) : undefined;
	if (icon) meta.icon = icon;
	// The created date is the export's own property: its properties table (else its header), never a row of the body.
	const properties = [...text.matchAll(/<table\b[^>]*class="[^"]*\bproperties\b[^"]*"[^>]*>([\s\S]*?)<\/table>/gi)].map((match) => match[1]);
	const propertyScope = properties.length ? properties.join('') : (/<header\b[^>]*>([\s\S]*?)<\/header>/i.exec(text)?.[1] ?? '');
	for (const row of propertyScope.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
		const head = /<th\b[^>]*>([\s\S]*?)<\/th>/i.exec(row[1]);
		const cell = /<td\b[^>]*>([\s\S]*?)<\/td>/i.exec(row[1]);
		if (head && cell && /^created( time| at)?$/i.test(htmlText(head[1]))) {
			const date = exportDateOf(htmlText(cell[1]));
			if (date) {
				meta.createdAt = date;
				break;
			}
		}
	}

	let body = /<div\b[^>]*class="[^"]*\bpage-body\b[^"]*"[^>]*>([\s\S]*)<\/div>\s*<\/article>/i.exec(text)?.[1] ?? /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(text)?.[1] ?? text;
	body = body.replace(/<header\b[\s\S]*?<\/header>/gi, '');
	return { meta, markdown: htmlToMarkdown(body) };
}

/**
 * Sanitized HTML → Markdown. The allowlist keeps structure (headings, paragraphs, lists, quotes, code, tables, rules,
 * marks, links, images, task boxes); links keep http, https, mailto, tel and relative targets (relative ones are the
 * export's links between pages and to attachments); images keep http, https and relative sources, never `data:`.
 */
export function htmlToMarkdown(html: string): string {
	// The export's task boxes are `div.checkbox-on` / `-off`: made checkboxes the task-list rule understands.
	const boxes = String(html ?? '')
		.replace(/<div\b[^>]*class="[^"]*\bcheckbox-on\b[^"]*"[^>]*>\s*<\/div>/gi, '<input type="checkbox" checked>')
		.replace(/<div\b[^>]*class="[^"]*\bcheckbox-off\b[^"]*"[^>]*>\s*<\/div>/gi, '<input type="checkbox">');
	const clean = sanitizeHtml(boxes, {
		allowedTags: [
			'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
			'p', 'br', 'hr', 'blockquote', 'pre', 'code',
			'ul', 'ol', 'li', 'input',
			'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
			'strong', 'b', 'em', 'i', 'u', 's', 'del', 'strike', 'mark', 'a', 'img', 'span', 'div', 'figure', 'figcaption',
			'details', 'summary'
		],
		allowedAttributes: { a: ['href', 'title'], img: ['src', 'alt', 'title'], input: ['type', 'checked'], ol: ['start'] },
		allowedSchemes: ['http', 'https', 'mailto', 'tel'],
		allowedSchemesByTag: { img: ['http', 'https'] },
		allowProtocolRelative: false,
		disallowedTagsMode: 'discard',
		exclusiveFilter: (frame) => frame.tag === 'input' && frame.attribs?.['type'] !== 'checkbox'
	});
	let markdown: string;
	try {
		markdown = createTurndown().turndown(clean);
	} catch {
		markdown = htmlText(clean);
	}
	return markdown.replace(/\n{3,}/g, '\n\n').trim();
}

/** A page file as the import reads it: Markdown as written, HTML through {@link readHtmlPage}. */
export function readImportPage(text: string, format: ImportPageFormat, layout: DocumentImportLayoutEnum): IImportPageSource {
	return format === 'html' ? readHtmlPage(text) : readMarkdownPage(text, layout);
}

// ---------------------------------------------------------------- wiki syntax

/** Markdown-escapes a link text: what would read as a link, an emphasis or an escape is escaped. */
function escapeLinkText(text: string): string {
	return text.replace(/[\\[\]*_`<>]/g, (char) => `\\${char}`);
}

/** A wiki link's parts: `target#heading|alias` (a table's `\|` is a `|`). */
export function parseWikiTarget(inner: string): { target: string; heading?: string; alias?: string } {
	const unescaped = inner.replace(/\\\|/g, '|');
	const bar = unescaped.indexOf('|');
	const left = (bar >= 0 ? unescaped.slice(0, bar) : unescaped).trim();
	const alias = bar >= 0 ? unescaped.slice(bar + 1).trim() : undefined;
	const hash = left.indexOf('#');
	const target = (hash >= 0 ? left.slice(0, hash) : left).trim();
	const heading = hash >= 0 ? left.slice(hash + 1).replace(/^\^/, '').trim() : undefined;
	return { target, ...(heading ? { heading } : {}), ...(alias ? { alias } : {}) };
}

/** Rewrites the wiki syntax of one run of text (no code in it). */
function rewriteWikiRun(text: string): string {
	return text.replace(/(!?)\[\[([^\]\n]{1,500}?)\]\]/g, (_all, bang: string, inner: string) => {
		const { target, heading, alias } = parseWikiTarget(inner);
		if (!target && !heading) return _all;
		const destination = encodeURIComponent(target || '');
		if (bang) {
			// `![[file.png|300]]`: a size, not an alias.
			const alt = alias && !/^\d+(x\d+)?$/.test(alias) ? alias : target.split('/').pop() ?? target;
			return `![${escapeLinkText(alt)}](${WIKI_EMBED_SCHEME}${destination})`;
		}
		const shown = alias ?? (heading ? `${target.split('/').pop()} › ${heading}` : target.split('/').pop() ?? target);
		return `[${escapeLinkText(shown || target)}](${WIKI_LINK_SCHEME}${destination})`;
	});
}

/** Rewrites one line outside fences, leaving its code spans as they are. */
function rewriteWikiLine(line: string): string {
	let output = '';
	let index = 0;
	while (index < line.length) {
		const tick = line.indexOf('`', index);
		if (tick < 0) {
			output += rewriteWikiRun(line.slice(index));
			break;
		}
		output += rewriteWikiRun(line.slice(index, tick));
		let run = 1;
		while (line[tick + run] === '`') run += 1;
		const fence = '`'.repeat(run);
		let close = line.indexOf(fence, tick + run);
		while (close >= 0 && line[close + run] === '`') close = line.indexOf(fence, close + run + 1);
		if (close < 0) {
			output += line.slice(tick, tick + run);
			index = tick + run;
			continue;
		}
		output += line.slice(tick, close + run);
		index = close + run;
	}
	return output;
}

/**
 * Rewrites `[[target]]`, `[[target|alias]]`, `[[target#heading]]` and `![[file]]` / `![[file|300]]` to Markdown links
 * and images with internal schemes the conversion resolves — outside fenced code blocks and code spans, where the
 * syntax is text.
 */
export function rewriteWikiSyntax(markdown: string): string {
	const lines = String(markdown ?? '').split('\n');
	let fence: string | null = null;
	return lines
		.map((line) => {
			const opener = /^ {0,3}(`{3,}|~{3,})/.exec(line);
			if (fence) {
				if (opener && opener[1][0] === fence[0] && opener[1].length >= fence.length && !line.trim().slice(opener[1].length).trim()) fence = null;
				return line;
			}
			if (opener) {
				fence = opener[1];
				return line;
			}
			return line.includes('[[') ? rewriteWikiLine(line) : line;
		})
		.join('\n');
}

// ---------------------------------------------------------------- conversion

const textOf = (nodes: IDocNode[]): string => nodes.map((node) => (node.type === 'text' ? node.text ?? '' : textOf(node.content ?? []))).join('');

const isImageMime = (mime: unknown): boolean => /^image\/(png|jpe?g|gif|webp)$/i.test(String(mime ?? ''));

/** The link mark of a text node, if any. */
const linkOf = (node: IDocNode): IDocMark | undefined => node.marks?.find((mark) => mark.type === 'link');

/**
 * Converts one page of an import (`docs-import-export` spec FR-7, FR-8): the wiki syntax rewritten, the Markdown
 * parsed with the platform's converter, then every link and image resolved against what the import created —
 *
 * - a link to a page becomes a page mention (its text as the label); to an attachment, a link to the stored file;
 * - an image of an attachment becomes the stored image; an embed of another file becomes an attachment card (a
 *   paragraph holding only it) or a link to it; an embed of a page, a page mention;
 * - http, https, mailto and tel links stay; external images stay; any other target is dropped, its text kept, and a
 *   link that pointed into the archive at nothing the import created is counted as unresolved;
 * - a leading heading equal to the title is dropped; the result passes the page schema, or the page is stored as
 *   plain paragraphs (and says so).
 */
export function convertImportedPage(input: IImportConvertInput): IImportConvertResult {
	const counter = { unresolved: 0 };
	const mentioned = new Set<string>();
	const markdown = rewriteWikiSyntax(input.source.markdown);
	const parsed = markdownToDocument(markdown);
	const walk = new ImportContentWalk(input, counter, mentioned);
	let content = walk.blocks(parsed.content ?? []);
	content = dropLeadingTitle(content, input.title);
	const doc: IDocNode = { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
	try {
		validateTiptapDocument(doc);
		return { contentJson: doc, unresolvedLinks: counter.unresolved, mentionedDocumentIds: [...mentioned], schemaFallback: false };
	} catch {
		return { contentJson: plainDocument(input.source.markdown), unresolvedLinks: counter.unresolved, mentionedDocumentIds: [], schemaFallback: true };
	}
}

/** A document of plain paragraphs (the schema fallback): one per block of text, no marks. */
export function plainDocument(markdown: string): IDocNode {
	const blocks = String(markdown ?? '')
		.split(/\n{2,}/)
		.map((block) => block.replace(/\s+/g, ' ').trim())
		.filter(Boolean)
		.slice(0, 5000);
	return { type: 'doc', content: blocks.length ? blocks.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })) : [{ type: 'paragraph' }] };
}

/** Drops the first block when it is a heading that repeats the page's title. */
function dropLeadingTitle(blocks: IDocNode[], title: string): IDocNode[] {
	const first = blocks[0];
	if (first?.type !== 'heading') return blocks;
	const norm = (value: string) => value.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
	return norm(textOf(first.content ?? [])) === norm(title) ? blocks.slice(1) : blocks;
}

/** The walk over one page's parsed JSON. */
class ImportContentWalk {
	constructor(
		private readonly input: IImportConvertInput,
		private readonly counter: { unresolved: number },
		private readonly mentioned: Set<string>
	) {}

	/** Block-level content: a paragraph that holds only an attachment card becomes the card. */
	blocks(nodes: IDocNode[]): IDocNode[] {
		const output: IDocNode[] = [];
		for (const node of nodes) {
			if (node.type === 'paragraph' && node.content?.length) {
				const inline = this.inline(node.content);
				const cards = inline.filter((child) => child.type === 'fileAttachment');
				const rest = inline.filter((child) => child.type !== 'fileAttachment' && !(child.type === 'text' && !String(child.text ?? '').trim()));
				if (cards.length && !rest.length) {
					output.push(...cards);
					continue;
				}
				// A card inside running text is a link to the file.
				output.push({ ...node, content: inline.map((child) => (child.type === 'fileAttachment' ? this.fileLink(child) : child)) });
				continue;
			}
			if (node.type === 'image') {
				// An image on a line of its own (the parser reads it as a block): resolved as one in running text is, and
				// kept a block when it is one (a stored image, an attachment card); a page mention or the text standing in
				// for it is a paragraph of its own.
				for (const child of this.image(node)) {
					output.push(
						child.type === 'image' || child.type === 'fileAttachment'
							? child
							: { type: 'paragraph', content: [child] }
					);
				}
				continue;
			}
			if (node.type === 'text' || node.type === 'hardBreak') {
				output.push(node);
				continue;
			}
			if (node.type === 'heading' || node.type === 'tableHeader' || node.type === 'tableCell' || node.type === 'codeBlock') {
				const content = node.type === 'codeBlock' ? node.content : node.content && this.inlineOrBlocks(node);
				output.push(content ? { ...node, content } : node);
				continue;
			}
			output.push(node.content ? { ...node, content: this.blocks(node.content) } : node);
		}
		return output;
	}

	/** A heading's inline content, or a table cell's blocks. */
	private inlineOrBlocks(node: IDocNode): IDocNode[] {
		if (node.type === 'heading') {
			return this.inline(node.content ?? []).map((child) => (child.type === 'fileAttachment' ? this.fileLink(child) : child));
		}
		return this.blocks(node.content ?? []);
	}

	/** Inline content: links grouped by target and resolved, images resolved. */
	inline(nodes: IDocNode[]): IDocNode[] {
		const output: IDocNode[] = [];
		for (let index = 0; index < nodes.length; index++) {
			const node = nodes[index];
			if (node.type === 'image') {
				output.push(...this.image(node));
				continue;
			}
			const link = node.type === 'text' ? linkOf(node) : undefined;
			if (!link) {
				output.push(node);
				continue;
			}
			// The run of text nodes that carry the same link (a link with a bold word is several nodes).
			const href = String(link.attrs?.['href'] ?? '');
			const run: IDocNode[] = [node];
			while (index + 1 < nodes.length && nodes[index + 1].type === 'text' && String(linkOf(nodes[index + 1])?.attrs?.['href'] ?? '\u0000') === href) {
				run.push(nodes[++index]);
			}
			output.push(...this.link(run, href));
		}
		return output;
	}

	/** A run of linked text, resolved. */
	private link(run: IDocNode[], href: string): IDocNode[] {
		if (KEPT_LINK_SCHEMES.test(href)) return run;
		const target = this.targetOf(href, false);
		const unlinked = run.map((node) => withoutLink(node));
		if (!target) return unlinked;
		const resolved = this.input.resolve(target);
		if (!resolved) {
			this.counter.unresolved += 1;
			return unlinked;
		}
		if (target.kind === 'page') {
			this.mentioned.add(resolved.documentId);
			const label = textOf(run).trim() || resolved.name;
			return [{ type: 'documentMention', attrs: { id: resolved.documentId, label, mentionSuggestionChar: '+' } }];
		}
		return run.map((node) => withLinkTo(node, rawFileUrlOf(resolved.documentId)));
	}

	/** An image: stored attachment, page mention, attachment card, kept external image, or its text. */
	private image(node: IDocNode): IDocNode[] {
		const src = String(node.attrs?.['src'] ?? '');
		const alt = String(node.attrs?.['alt'] ?? '').trim();
		if (KEPT_IMAGE_SCHEMES.test(src)) return [node];
		const target = this.targetOf(src, true);
		if (!target) return alt ? [{ type: 'text', text: alt }] : [];
		const resolved = this.input.resolve(target);
		if (!resolved) {
			this.counter.unresolved += 1;
			return alt ? [{ type: 'text', text: alt }] : [];
		}
		if (target.kind === 'page') {
			this.mentioned.add(resolved.documentId);
			return [{ type: 'documentMention', attrs: { id: resolved.documentId, label: alt || resolved.name, mentionSuggestionChar: '+' } }];
		}
		if (isImageMime(resolved.mimeType)) {
			const attrs: Record<string, unknown> = { src: rawFileUrlOf(resolved.documentId), documentId: resolved.documentId, alt: alt || null };
			if (node.attrs?.['title']) attrs['title'] = node.attrs['title'];
			return [{ type: 'image', attrs }];
		}
		return [
			{
				type: 'fileAttachment',
				attrs: { documentId: resolved.documentId, name: resolved.name, size: resolved.size ?? null, mimeType: resolved.mimeType ?? null }
			}
		];
	}

	/** A card that sits inside text, as a link to the stored file. */
	private fileLink(card: IDocNode): IDocNode {
		const id = String(card.attrs?.['documentId'] ?? '');
		return withLinkTo({ type: 'text', text: String(card.attrs?.['name'] ?? id) }, rawFileUrlOf(id));
	}

	/** What an href or a src names inside the archive: a wiki target, an embed, or a relative path. */
	private targetOf(href: string, embed: boolean): IImportLinkTarget | null {
		const { links, fromPath } = this.input;
		for (const scheme of [WIKI_LINK_SCHEME, WIKI_EMBED_SCHEME]) {
			if (href.startsWith(scheme)) {
				let target = href.slice(scheme.length);
				try {
					target = decodeURIComponent(target);
				} catch {
					// kept as written
				}
				const found = links.resolveWiki(target, fromPath, scheme === WIKI_EMBED_SCHEME || embed);
				if (!found) this.counter.unresolved += 1;
				return found;
			}
		}
		if (!href || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href) || href.startsWith('#') || href.startsWith('//')) return null;
		const found = links.resolveRelative(href, fromPath);
		if (!found) this.counter.unresolved += 1;
		return found;
	}
}

/** A text node without its link mark. */
function withoutLink(node: IDocNode): IDocNode {
	const marks = (node.marks ?? []).filter((mark) => mark.type !== 'link');
	const rest: IDocNode = { ...node };
	delete rest.marks;
	return marks.length ? { ...rest, marks } : rest;
}

/** A text node linked to `href` (an app-relative URL of the Documents API). */
function withLinkTo(node: IDocNode, href: string): IDocNode {
	const marks = (node.marks ?? []).filter((mark) => mark.type !== 'link');
	return { ...node, marks: [...marks, { type: 'link', attrs: { href, target: '_blank', rel: 'noopener noreferrer nofollow' } }] };
}
