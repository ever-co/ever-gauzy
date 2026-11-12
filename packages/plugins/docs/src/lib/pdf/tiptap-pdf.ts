import { docOf, IDocMark, IDocNode, rawFileIdOf } from '../services/document-markdown';

/**
 * TipTap JSON → pdfmake content (`docs-import-export` spec FR-14, plan §6): pure, so it is tested without a renderer.
 *
 * The output is pdfmake's document-definition content (plain objects): text runs with marks, lists, tables, shaded
 * single-cell tables for quotes, callouts and code, canvas lines for rules, images by key of the definition's
 * `images` dictionary. Nothing here names a URL or a file the renderer would fetch: an image is drawn only when the
 * caller resolved it to an image key; any other image is its alternative text.
 */

/** A pdfmake content node (the library ships no types; the shape is its documented document definition). */
export type PdfContent = Record<string, unknown> | string;

/** An image the caller loaded: its key in the definition's `images`, and its pixel size. */
export interface IPdfImage {
	key: string;
	width: number;
	height: number;
}

/** What the renderer needs from its caller. */
export interface IPdfRenderContext {
	/** The image of a file of Docs, when it was loaded (by its document id). */
	imageOf(documentId: string): IPdfImage | null;
	/** The in-PDF destination of a page (a subtree export links its own pages), or null. */
	anchorOf?(documentId: string): string | null;
	/** The usable width of a sheet, in points. */
	contentWidth: number;
}

const LINK_COLOR = '#1a56db';
const MUTED = '#555555';
const RULE = '#d0d3d8';
const CODE_FILL = '#f4f5f7';
const CALLOUT_FILLS: Readonly<Record<string, string>> = {
	info: '#eef4ff',
	note: '#eef4ff',
	tip: '#eefaf0',
	success: '#eefaf0',
	warning: '#fff7e6',
	danger: '#fdecec',
	error: '#fdecec'
};

/** Links a PDF may carry: http, https, mailto, tel. */
const PDF_LINK = /^(https?:|mailto:|tel:)/i;

/** The pdfmake styles the content uses (merged into the definition by the service). */
export const PDF_STYLES: Readonly<Record<string, Record<string, unknown>>> = {
	h1: { fontSize: 20, bold: true, margin: [0, 10, 0, 6] },
	h2: { fontSize: 16, bold: true, margin: [0, 10, 0, 5] },
	h3: { fontSize: 14, bold: true, margin: [0, 8, 0, 4] },
	h4: { fontSize: 12, bold: true, margin: [0, 8, 0, 4] },
	h5: { fontSize: 11, bold: true, margin: [0, 6, 0, 3] },
	h6: { fontSize: 11, bold: true, italics: true, margin: [0, 6, 0, 3] },
	pageTitle: { fontSize: 24, bold: true, margin: [0, 0, 0, 12] },
	code: { fontSize: 9, color: '#24292f' },
	muted: { color: MUTED }
};

const childrenOf = (node: IDocNode | undefined): IDocNode[] => (Array.isArray(node?.content) ? (node?.content as IDocNode[]) : []);
const attrsOf = (node: IDocNode | IDocMark | undefined): Record<string, unknown> =>
	node?.attrs && typeof node.attrs === 'object' ? (node.attrs as Record<string, unknown>) : {};

/** A human size (`1.2 MB`), locale-neutral. */
export function formatBytes(size: unknown): string {
	const bytes = Number(size);
	if (!Number.isFinite(bytes) || bytes <= 0) return '';
	const units = ['B', 'KB', 'MB', 'GB'];
	let value = bytes;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit += 1;
	}
	return `${unit === 0 ? value : value.toFixed(1)} ${units[unit]}`;
}

/** The text of a node, marks aside. */
export function plainTextOf(node: IDocNode | undefined): string {
	if (!node) return '';
	if (node.type === 'text') return String(node.text ?? '');
	if (node.type === 'hardBreak') return '\n';
	return childrenOf(node).map(plainTextOf).join('');
}

/** One text run with its marks. */
function textRun(node: IDocNode): Record<string, unknown> {
	const run: Record<string, unknown> = { text: String(node.text ?? '') };
	const decorations: string[] = [];
	for (const mark of node.marks ?? []) {
		const attrs = attrsOf(mark);
		switch (mark.type) {
			case 'bold':
				run['bold'] = true;
				break;
			case 'italic':
				run['italics'] = true;
				break;
			case 'underline':
				decorations.push('underline');
				break;
			case 'strike':
				decorations.push('lineThrough');
				break;
			case 'code':
				run['style'] = 'code';
				run['background'] = CODE_FILL;
				break;
			case 'superscript':
				run['sup'] = true;
				break;
			case 'subscript':
				run['sub'] = true;
				break;
			case 'highlight':
				run['background'] = typeof attrs['color'] === 'string' && /^#[0-9a-f]{3,8}$/i.test(attrs['color'] as string) ? attrs['color'] : '#fff3b0';
				break;
			case 'textStyle':
				if (typeof attrs['color'] === 'string' && /^#[0-9a-f]{3,8}$/i.test(attrs['color'] as string)) run['color'] = attrs['color'];
				break;
			case 'link': {
				const href = String(attrs['href'] ?? '');
				if (PDF_LINK.test(href)) run['link'] = href;
				run['color'] = LINK_COLOR;
				decorations.push('underline');
				break;
			}
		}
	}
	if (decorations.length) run['decoration'] = decorations.length === 1 ? decorations[0] : decorations;
	return run;
}

/** The inline content of a block as pdfmake text runs (images are hoisted by {@link inlineBlocks}). */
function inlineRuns(nodes: IDocNode[], ctx: IPdfRenderContext): Record<string, unknown>[] {
	const runs: Record<string, unknown>[] = [];
	for (const node of nodes) {
		const attrs = attrsOf(node);
		switch (node.type) {
			case 'text':
				if (node.text) runs.push(textRun(node));
				break;
			case 'hardBreak':
				runs.push({ text: '\n' });
				break;
			case 'employeeMention':
				runs.push({ text: `@${String(attrs['label'] ?? attrs['id'] ?? '')}`, color: LINK_COLOR });
				break;
			case 'documentMention': {
				const anchor = ctx.anchorOf?.(String(attrs['id'] ?? '')) ?? null;
				runs.push({ text: String(attrs['label'] ?? attrs['id'] ?? ''), color: LINK_COLOR, ...(anchor ? { linkToDestination: anchor } : {}) });
				break;
			}
			case 'emoji':
				runs.push({ text: `:${String(attrs['name'] ?? '')}:` });
				break;
			case 'inlineMath':
				runs.push({ text: String(attrs['latex'] ?? ''), italics: true });
				break;
			case 'image':
				break;
			default:
				runs.push(...inlineRuns(childrenOf(node), ctx));
		}
	}
	return runs;
}

/** A block of inline content: one paragraph, or paragraphs around the images it holds (pdfmake draws images as blocks). */
function inlineBlocks(node: IDocNode, ctx: IPdfRenderContext, base: Record<string, unknown>): PdfContent[] {
	const blocks: PdfContent[] = [];
	let pending: IDocNode[] = [];
	const flush = () => {
		const runs = inlineRuns(pending, ctx);
		if (runs.length) blocks.push({ ...base, text: runs });
		pending = [];
	};
	for (const child of childrenOf(node)) {
		if (child.type === 'image') {
			flush();
			blocks.push(imageBlock(child, ctx));
		} else {
			pending.push(child);
		}
	}
	flush();
	if (!blocks.length) blocks.push({ ...base, text: ' ' });
	return blocks;
}

/** An image of Docs that was loaded, fitted to the sheet; any other image is its alternative text. */
function imageBlock(node: IDocNode, ctx: IPdfRenderContext): PdfContent {
	const attrs = attrsOf(node);
	const id = rawFileIdOf(attrs['src']) ?? (typeof attrs['documentId'] === 'string' ? (attrs['documentId'] as string) : null);
	const image = id ? ctx.imageOf(id) : null;
	if (!image) {
		const alt = String(attrs['alt'] ?? attrs['title'] ?? '').trim();
		return { text: alt ? `[${alt}]` : '', style: 'muted', italics: true, margin: [0, 2, 0, 6] };
	}
	// Points = pixels at 96 dpi, never wider than the sheet nor taller than most of it.
	const width = Math.min(ctx.contentWidth, Math.max(16, Math.round(image.width * 0.75)));
	const alignment = attrs['align'] === 'center' || attrs['align'] === 'right' ? attrs['align'] : 'left';
	return { image: image.key, fit: [width, 640], alignment, margin: [0, 4, 0, 8] };
}

/** A list's items. */
function listItems(node: IDocNode, ctx: IPdfRenderContext, task: boolean): PdfContent[] {
	return childrenOf(node).map((item) => {
		const blocks = blocksOf(childrenOf(item), ctx);
		if (task) {
			const box = attrsOf(item)['checked'] === true ? '[x] ' : '[ ] ';
			const [first, ...rest] = blocks;
			const lead = typeof first === 'object' && first && 'text' in first ? { ...first, text: [{ text: box }, ...asRuns(first['text'])] } : { text: box };
			return { stack: [lead, ...(typeof first === 'object' && first && 'text' in first ? rest : blocks)] };
		}
		return blocks.length === 1 ? blocks[0] : { stack: blocks };
	});
}

/** A text value as a run list. */
function asRuns(text: unknown): Record<string, unknown>[] {
	if (Array.isArray(text)) return text as Record<string, unknown>[];
	return [{ text: String(text ?? '') }];
}

/** A shaded, single-cell box (quotes, callouts, code). */
function box(stack: PdfContent[], fill: string | null, leftRule: string | null, margin: number[] = [0, 4, 0, 8]): PdfContent {
	return {
		table: { widths: ['*'], body: [[{ stack: stack.length ? stack : [{ text: ' ' }] }]] },
		layout: {
			fillColor: () => fill,
			hLineWidth: () => 0,
			vLineWidth: (index: number) => (leftRule && index === 0 ? 2 : 0),
			vLineColor: () => leftRule ?? RULE,
			paddingLeft: () => 8,
			paddingRight: () => 8,
			paddingTop: () => 5,
			paddingBottom: () => 5
		},
		margin
	};
}

/**
 * A table: header cells bold, `colspan` and `rowspan` honoured. pdfmake wants a placeholder (`{}`) in every grid
 * position a span covers — beside a cell for its columns, in the rows below for its rows — so the cells of each row
 * are laid on a grid that remembers which columns a span from above still covers.
 */
function tableBlock(node: IDocNode, ctx: IPdfRenderContext): PdfContent | null {
	const rows = childrenOf(node).filter((row) => row.type === 'tableRow');
	if (!rows.length) return null;
	const clamp = (value: unknown, max: number) => Math.max(1, Math.min(max, Number(value) || 1));
	/** How many more rows each column is covered by a span from above. */
	const covered: number[] = [];
	const body = rows.map((row, rowIndex) => {
		const cells: Record<string, unknown>[] = [];
		let column = 0;
		const skipCovered = () => {
			while ((covered[column] ?? 0) > 0) {
				cells.push({});
				covered[column] -= 1;
				column += 1;
			}
		};
		for (const cell of childrenOf(row)) {
			skipCovered();
			const colSpan = clamp(attrsOf(cell)['colspan'], 20);
			const rowSpan = clamp(attrsOf(cell)['rowspan'], rows.length - rowIndex);
			const content = blocksOf(childrenOf(cell), ctx);
			cells.push({
				stack: content.length ? content : [{ text: ' ' }],
				bold: cell.type === 'tableHeader',
				...(colSpan > 1 ? { colSpan } : {}),
				...(rowSpan > 1 ? { rowSpan } : {})
			});
			for (let i = 1; i < colSpan; i++) cells.push({});
			for (let i = 0; i < colSpan; i++) covered[column + i] = Math.max(covered[column + i] ?? 0, rowSpan - 1);
			column += colSpan;
		}
		// Columns after this row's last cell that a span from above still covers.
		for (; column < covered.length; column++) {
			if ((covered[column] ?? 0) > 0) {
				cells.push({});
				covered[column] -= 1;
			} else {
				cells.push({ text: '' });
			}
		}
		return cells;
	});
	const width = Math.max(...body.map((row) => row.length), 1);
	for (const row of body) while (row.length < width) row.push({ text: '' });
	const headerRow = childrenOf(rows[0]).length > 0 && childrenOf(rows[0]).every((cell) => cell.type === 'tableHeader');
	return {
		table: { headerRows: headerRow ? 1 : 0, widths: Array(width).fill('*'), body },
		layout: {
			hLineColor: () => RULE,
			vLineColor: () => RULE,
			hLineWidth: () => 0.5,
			vLineWidth: () => 0.5,
			fillColor: (rowIndex: number) => (rowIndex === 0 && headerRow ? '#f6f7f9' : null)
		},
		margin: [0, 4, 0, 8]
	};
}

/** Block content. */
function blocksOf(nodes: IDocNode[], ctx: IPdfRenderContext): PdfContent[] {
	const out: PdfContent[] = [];
	for (const node of nodes) {
		const attrs = attrsOf(node);
		switch (node.type) {
			case 'paragraph': {
				const alignment = ['center', 'right', 'justify'].includes(String(attrs['textAlign'])) ? String(attrs['textAlign']) : undefined;
				out.push(...inlineBlocks(node, ctx, { margin: [0, 0, 0, 6], ...(alignment ? { alignment } : {}) }));
				break;
			}
			case 'heading': {
				const level = Math.min(Math.max(Number(attrs['level']) || 1, 1), 6);
				out.push(...inlineBlocks(node, ctx, { style: `h${level}` }));
				break;
			}
			case 'bulletList':
				out.push({ ul: listItems(node, ctx, false), margin: [0, 0, 0, 6] });
				break;
			case 'orderedList':
				out.push({ ol: listItems(node, ctx, false), start: Number(attrs['start']) || 1, margin: [0, 0, 0, 6] });
				break;
			case 'taskList':
				out.push({ ul: listItems(node, ctx, true), type: 'none', margin: [0, 0, 0, 6] });
				break;
			case 'listItem':
			case 'taskItem':
				out.push(...blocksOf(childrenOf(node), ctx));
				break;
			case 'blockquote':
				out.push(box(blocksOf(childrenOf(node), ctx), null, RULE));
				break;
			case 'callout': {
				const fill = CALLOUT_FILLS[String(attrs['type'] ?? '').toLowerCase()] ?? '#f6f7f9';
				out.push(box(blocksOf(childrenOf(node), ctx), fill, null));
				break;
			}
			case 'codeBlock':
				out.push(box([{ text: plainTextOf(node) || ' ', style: 'code', preserveLeadingSpaces: true }], CODE_FILL, null));
				break;
			case 'horizontalRule':
				out.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: ctx.contentWidth, y2: 0, lineWidth: 0.5, lineColor: RULE }], margin: [0, 6, 0, 8] });
				break;
			case 'table': {
				const table = tableBlock(node, ctx);
				if (table) out.push(table);
				break;
			}
			case 'image':
				out.push(imageBlock(node, ctx));
				break;
			case 'details': {
				const summary = childrenOf(node).find((child) => child.type === 'detailsSummary');
				const content = childrenOf(node).find((child) => child.type === 'detailsContent');
				if (summary) out.push(...inlineBlocks(summary, ctx, { bold: true, margin: [0, 2, 0, 4] }));
				if (content) out.push({ stack: blocksOf(childrenOf(content), ctx), margin: [12, 0, 0, 6] });
				break;
			}
			case 'blockMath':
				out.push({ text: String(attrs['latex'] ?? ''), italics: true, alignment: 'center', margin: [0, 4, 0, 8] });
				break;
			case 'fileAttachment': {
				const size = formatBytes(attrs['size']);
				out.push({ text: [{ text: String(attrs['name'] ?? attrs['documentId'] ?? ''), bold: true }, ...(size ? [{ text: `  ${size}`, style: 'muted' }] : [])], margin: [0, 2, 0, 6] });
				break;
			}
			case 'embedCard':
			case 'youtube': {
				const url = String(attrs['url'] ?? attrs['src'] ?? '');
				const title = String(attrs['title'] ?? '') || url;
				out.push({ text: title, ...(PDF_LINK.test(url) ? { link: url } : {}), color: LINK_COLOR, decoration: 'underline', margin: [0, 2, 0, 6] });
				break;
			}
			default:
				if (node.content) out.push(...blocksOf(childrenOf(node), ctx));
				else if (node.type === 'text') out.push({ text: [textRun(node)] });
		}
	}
	return out;
}

/**
 * The pdfmake content of a page's stored JSON.
 *
 * @param contentJson The page's `contentJson` (an object, or its JSON text on SQLite).
 * @param ctx The images and anchors the caller resolved, and the sheet width.
 */
export function tiptapToPdfContent(contentJson: unknown, ctx: IPdfRenderContext): PdfContent[] {
	return blocksOf(childrenOf(docOf(contentJson)), ctx);
}

/** The ids of the files a page shows as images (to load before rendering). */
export function collectImageIds(contentJson: unknown): string[] {
	const ids = new Set<string>();
	const walk = (node: IDocNode): void => {
		if (node.type === 'image') {
			const attrs = attrsOf(node);
			const id = rawFileIdOf(attrs['src']) ?? (typeof attrs['documentId'] === 'string' ? (attrs['documentId'] as string) : null);
			if (id) ids.add(id);
		}
		childrenOf(node).forEach(walk);
	};
	walk(docOf(contentJson));
	return [...ids];
}
