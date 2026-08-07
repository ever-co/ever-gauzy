import { IDocumentChunkMetadata } from '@gauzy/contracts';
import { getTokenCounter, ITokenCounter, TokenCounterKind } from './token-counter';

/**
 * Heading-aware markdown chunker (§6 of the AI-knowledge spec).
 *
 * Pure, deterministic, zero-AI: the same input always produces byte-identical chunks —
 * this determinism is what makes contentHash short-circuits and locator backfills safe.
 *
 * - Blocks split at markdown headings (`#`–`###`) and blank-line paragraph boundaries.
 * - Blocks are greedily packed into ~`chunkTokens` windows; only a single block longer
 *   than a whole window is hard-split (at the last line boundary, else last space).
 * - `overlapTokens` are carried from the tail of the previous chunk, starting at a word
 *   boundary. The overlap is context only — locator metadata is derived from the chunk's
 *   anchor block, not the overlap tail.
 * - Oversized pipe tables split on row boundaries with the header + delimiter row
 *   repeated atop every slice; table slices get no generic overlap.
 * - Whole-document fast path: total ≤ `chunkTokens` ⇒ one verbatim chunk.
 * - Locator headings (`## Page N`, `## Sheet: <name>`) update `page`/`sheet` state and are
 *   excluded from `headingPath`.
 */

export interface IMarkdownChunk {
	/** 0-based position within the document. */
	chunkIndex: number;
	/** Chunk text (overlap prefix + anchored source slice). */
	content: string;
	/** Token count of `content` per the active counter. */
	tokenCount: number;
	/** Citation locators of the anchor block. */
	metadata: IDocumentChunkMetadata;
}

export interface IChunkingResult {
	chunks: IMarkdownChunk[];
	/** Which token counter produced the counts (recorded in `metadata.indexing.tokenCounter`). */
	tokenCounter: TokenCounterKind;
}

export interface IChunkingOptions {
	/** Target window size in tokens (default 512). */
	chunkTokens?: number;
	/** Overlap carried between consecutive chunks in tokens (default 64). */
	overlapTokens?: number;
	/** Token counter override (tests inject the deterministic heuristic). */
	counter?: ITokenCounter;
}

/** Locator-heading shapes of §4.1 — recognized by exact pattern. */
const PAGE_HEADING = /^## Page (\d+)$/;
const SHEET_HEADING = /^## Sheet: (.+)$/;
const MARKDOWN_HEADING = /^(#{1,3})\s+(.*)$/;

interface IBlock {
	text: string;
	start: number;
	end: number;
	kind: 'heading' | 'paragraph' | 'table';
	/** Locator snapshot at this block. */
	headingPath: string[];
	page: number | null;
	sheet: string | null;
}

/**
 * Chunks normalized markdown into heading-aware token windows with locator metadata.
 *
 * @param markdown Normalized markdown (LF line endings — the extraction contract).
 * @param options Window/overlap sizes and an optional counter override.
 * @returns The deterministic chunk list plus the counter identity used.
 */
export function chunkMarkdown(markdown: string, options: IChunkingOptions = {}): IChunkingResult {
	const counter = options.counter ?? getTokenCounter();
	const chunkTokens = options.chunkTokens !== undefined && options.chunkTokens > 0 ? options.chunkTokens : 512;
	const overlapTokens =
		options.overlapTokens !== undefined && options.overlapTokens >= 0 ? options.overlapTokens : 64;

	const source = markdown ?? '';
	if (!source.trim()) {
		return { chunks: [], tokenCounter: counter.kind };
	}

	// Whole-document fast path.
	if (counter.count(source) <= chunkTokens) {
		return {
			chunks: [
				{
					chunkIndex: 0,
					content: source,
					tokenCount: counter.count(source),
					metadata: {
						headingPath: [],
						page: undefined,
						sheet: undefined,
						charRange: { start: 0, end: source.length }
					}
				}
			],
			tokenCounter: counter.kind
		};
	}

	const blocks = splitBlocks(source);
	const chunks: IMarkdownChunk[] = [];

	/** Blocks accumulated into the current window. */
	let window: IBlock[] = [];
	let windowTokens = 0;
	/** Overlap text carried into the next emitted chunk ('' after a table slice). */
	let pendingOverlap = '';

	const emitWindow = (): void => {
		if (!window.length) {
			return;
		}
		const anchor = window[0];
		const slice = source.slice(anchor.start, window[window.length - 1].end);
		const content = pendingOverlap ? `${pendingOverlap}\n\n${slice}` : slice;
		chunks.push({
			chunkIndex: chunks.length,
			content,
			tokenCount: counter.count(content),
			metadata: {
				headingPath: anchor.headingPath,
				page: anchor.page ?? undefined,
				sheet: anchor.sheet ?? undefined,
				charRange: { start: anchor.start, end: window[window.length - 1].end }
			}
		});
		pendingOverlap = overlapTokens > 0 ? takeTailByTokens(slice, overlapTokens, counter) : '';
		window = [];
		windowTokens = 0;
	};

	for (const block of blocks) {
		const blockTokens = counter.count(block.text);

		// Oversized pipe table → row-boundary slices with the header repeated; no overlap.
		if (block.kind === 'table' && blockTokens > chunkTokens) {
			emitWindow();
			pendingOverlap = '';
			for (const slice of sliceTable(block, chunkTokens, counter)) {
				chunks.push({
					chunkIndex: chunks.length,
					content: slice.content,
					tokenCount: counter.count(slice.content),
					metadata: {
						headingPath: block.headingPath,
						page: block.page ?? undefined,
						sheet: block.sheet ?? undefined,
						charRange: { start: slice.start, end: slice.end }
					}
				});
			}
			continue;
		}

		// A single non-table block longer than a whole window → hard-split pieces that then
		// pack like ordinary blocks.
		const pieces: IBlock[] = blockTokens > chunkTokens ? hardSplitBlock(block, chunkTokens, counter) : [block];

		for (const piece of pieces) {
			const pieceTokens = counter.count(piece.text);
			if (window.length && windowTokens + pieceTokens > chunkTokens) {
				emitWindow();
			}
			window.push(piece);
			windowTokens += pieceTokens;
		}
	}
	emitWindow();

	return { chunks, tokenCounter: counter.kind };
}

/**
 * Splits normalized markdown into blocks at heading lines and blank-line boundaries,
 * tracking the enclosing-heading stack and the page/sheet locator state per block.
 */
function splitBlocks(source: string): IBlock[] {
	const blocks: IBlock[] = [];
	const headingStack: Array<{ level: number; text: string }> = [];
	let page: number | null = null;
	let sheet: string | null = null;

	const lines = source.split('\n');
	let offset = 0;

	/** Current paragraph accumulation. */
	let paraStart = -1;
	let paraLines: string[] = [];

	const snapshotPath = (): string[] => headingStack.map((entry) => entry.text);

	const flushParagraph = (endOffset: number): void => {
		if (paraStart < 0 || !paraLines.length) {
			paraStart = -1;
			paraLines = [];
			return;
		}
		const text = paraLines.join('\n');
		const isTable = paraLines.length >= 2 && paraLines.every((line) => line.trimStart().startsWith('|'));
		blocks.push({
			text,
			start: paraStart,
			end: endOffset,
			kind: isTable ? 'table' : 'paragraph',
			headingPath: snapshotPath(),
			page,
			sheet
		});
		paraStart = -1;
		paraLines = [];
	};

	for (const line of lines) {
		const lineStart = offset;
		const lineEnd = offset + line.length;
		offset = lineEnd + 1; // account for the LF

		const headingMatch = MARKDOWN_HEADING.exec(line);
		if (headingMatch) {
			flushParagraph(lineStart > 0 ? lineStart - 1 : lineStart);

			const pageMatch = PAGE_HEADING.exec(line);
			const sheetMatch = SHEET_HEADING.exec(line);
			if (pageMatch) {
				page = Number.parseInt(pageMatch[1], 10);
			} else if (sheetMatch) {
				sheet = sheetMatch[1];
			} else {
				const level = headingMatch[1].length;
				while (headingStack.length && headingStack[headingStack.length - 1].level >= level) {
					headingStack.pop();
				}
				headingStack.push({ level, text: headingMatch[2].trim() });
			}

			blocks.push({
				text: line,
				start: lineStart,
				end: lineEnd,
				kind: 'heading',
				headingPath: snapshotPath(),
				page,
				sheet
			});
			continue;
		}

		if (!line.trim()) {
			flushParagraph(lineStart > 0 ? lineStart - 1 : lineStart);
			continue;
		}

		if (paraStart < 0) {
			paraStart = lineStart;
		}
		paraLines.push(line);
	}
	flushParagraph(source.length);

	return blocks;
}

/**
 * Hard-splits one oversized non-table block into ≤`chunkTokens` pieces at the last line
 * boundary, else the last space (locator metadata inherited; offsets tracked).
 */
function hardSplitBlock(block: IBlock, chunkTokens: number, counter: ITokenCounter): IBlock[] {
	const pieces: IBlock[] = [];
	let remaining = block.text;
	let start = block.start;

	while (remaining.length) {
		if (counter.count(remaining) <= chunkTokens) {
			pieces.push({ ...block, text: remaining, start, end: start + remaining.length });
			break;
		}

		// Binary-search the largest prefix that fits the window.
		let low = 1;
		let high = remaining.length;
		while (low < high) {
			const mid = Math.ceil((low + high) / 2);
			if (counter.count(remaining.slice(0, mid)) <= chunkTokens) {
				low = mid;
			} else {
				high = mid - 1;
			}
		}
		let cut = low;

		// Prefer the last line boundary, else the last space, inside the fitting prefix.
		const prefix = remaining.slice(0, cut);
		const lastLine = prefix.lastIndexOf('\n');
		const lastSpace = prefix.lastIndexOf(' ');
		if (lastLine > 0) {
			cut = lastLine;
		} else if (lastSpace > 0) {
			cut = lastSpace;
		}

		const text = remaining.slice(0, cut);
		pieces.push({ ...block, text, start, end: start + text.length });
		// Skip the boundary character itself.
		remaining = remaining.slice(cut + 1);
		start += cut + 1;
	}

	return pieces;
}

interface ITableSlice {
	content: string;
	start: number;
	end: number;
}

/**
 * Slices an oversized pipe table on row boundaries, repeating the header + delimiter row
 * atop every slice.
 */
function sliceTable(block: IBlock, chunkTokens: number, counter: ITokenCounter): ITableSlice[] {
	const lines = block.text.split('\n');
	const header = lines.slice(0, 2).join('\n');
	const headerTokens = counter.count(header);
	const rows = lines.slice(2);

	// Row offsets inside the source: the block start plus the cumulative line lengths.
	let cursor = block.start + header.length + 1; // header + LF
	const rowMeta = rows.map((row) => {
		const start = cursor;
		cursor += row.length + 1;
		return { row, start, end: start + row.length };
	});

	const slices: ITableSlice[] = [];
	let sliceRows: typeof rowMeta = [];
	let sliceTokens = headerTokens;

	const flush = (): void => {
		if (!sliceRows.length) {
			return;
		}
		slices.push({
			content: `${header}\n${sliceRows.map((entry) => entry.row).join('\n')}`,
			start: sliceRows[0].start,
			end: sliceRows[sliceRows.length - 1].end
		});
		sliceRows = [];
		sliceTokens = headerTokens;
	};

	for (const entry of rowMeta) {
		const rowTokens = counter.count(entry.row);
		if (sliceRows.length && sliceTokens + rowTokens > chunkTokens) {
			flush();
		}
		sliceRows.push(entry);
		sliceTokens += rowTokens;
	}
	flush();

	// A header-only table (no data rows) degenerates to one slice of the whole block.
	if (!slices.length) {
		slices.push({ content: block.text, start: block.start, end: block.end });
	}
	return slices;
}

/**
 * Takes approximately `maxTokens` tokens from the tail of `text`, starting at a word
 * boundary (the inter-chunk overlap).
 */
function takeTailByTokens(text: string, maxTokens: number, counter: ITokenCounter): string {
	if (!text || maxTokens <= 0) {
		return '';
	}
	// Bound the scan window — 8 chars/token is a generous upper estimate.
	const scan = text.slice(-maxTokens * 8);
	const words = scan.split(/\s+/).filter(Boolean);

	let taken: string[] = [];
	for (let i = words.length - 1; i >= 0; i--) {
		const candidate = [words[i], ...taken];
		if (counter.count(candidate.join(' ')) > maxTokens) {
			break;
		}
		taken = candidate;
	}
	return taken.join(' ');
}
