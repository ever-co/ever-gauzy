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
/**
 * `(?=(\s+))\2` is the leading-whitespace run matched atomically: the lookahead captures the
 * maximal run and the backreference replays it, and a backreference cannot give characters
 * back. Written as a plain `\s+(.*)$` the two quantifiers both accept spaces, so every way of
 * splitting a run between them is retried whenever `$` fails — quadratic on a long line.
 * Named groups keep the two operands readable now that the run occupies a numbered group.
 */
const MARKDOWN_HEADING = /^(?<hashes>#{1,3})(?=(\s+))\2(?<text>.*)$/;

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

/** The chunking knobs after the documented defaults have been applied. */
interface IResolvedChunkingOptions {
	counter: ITokenCounter;
	chunkTokens: number;
	overlapTokens: number;
}

/**
 * Applies the documented defaults to a caller's partial options: a 512-token window, a
 * 64-token overlap, and the process-wide counter. An absent or out-of-range override falls
 * back to its default rather than disabling windowing.
 */
function resolveChunkingOptions(options: IChunkingOptions): IResolvedChunkingOptions {
	return {
		counter: options.counter ?? getTokenCounter(),
		chunkTokens: options.chunkTokens !== undefined && options.chunkTokens > 0 ? options.chunkTokens : 512,
		overlapTokens: options.overlapTokens !== undefined && options.overlapTokens >= 0 ? options.overlapTokens : 64
	};
}

/**
 * Projects one block's citation locators onto a chunk's char range. The locators always come
 * from the chunk's anchor block, never from an overlap tail carried in from the block before.
 */
function locatorMetadata(block: IBlock, start: number, end: number): IDocumentChunkMetadata {
	return {
		headingPath: block.headingPath,
		page: block.page ?? undefined,
		sheet: block.sheet ?? undefined,
		charRange: { start, end }
	};
}

/**
 * Chunks normalized markdown into heading-aware token windows with locator metadata.
 *
 * @param markdown Normalized markdown (LF line endings — the extraction contract).
 * @param options Window/overlap sizes and an optional counter override.
 * @returns The deterministic chunk list plus the counter identity used.
 */
export function chunkMarkdown(markdown: string, options: IChunkingOptions = {}): IChunkingResult {
	const { counter, chunkTokens, overlapTokens } = resolveChunkingOptions(options);

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

	const packer = new ChunkPacker(source, chunkTokens, overlapTokens, counter);
	for (const block of splitBlocks(source)) {
		packer.accept(block);
	}
	packer.flush();

	return { chunks: packer.chunks, tokenCounter: counter.kind };
}

/**
 * The greedy packing state of one `chunkMarkdown` run: the blocks accumulated into the current
 * window, the overlap tail carried into the next emitted chunk, and the chunks emitted so far.
 *
 * Held as one small mutable object rather than a nest of closures so that each packing decision
 * — window flush, oversized-table slicing, hard-split packing — reads as its own step.
 */
class ChunkPacker {
	/** Chunks emitted so far, in document order. */
	readonly chunks: IMarkdownChunk[] = [];
	/** Blocks accumulated into the current window. */
	private window: IBlock[] = [];
	private windowTokens = 0;
	/** Overlap text carried into the next emitted chunk ('' after a table slice). */
	private pendingOverlap = '';

	constructor(
		private readonly source: string,
		private readonly chunkTokens: number,
		private readonly overlapTokens: number,
		private readonly counter: ITokenCounter
	) {}

	/**
	 * Routes one block into the window: an oversized pipe table becomes row-boundary slices of
	 * its own, an oversized non-table block is hard-split first, everything else packs as-is.
	 */
	accept(block: IBlock): void {
		const blockTokens = this.counter.count(block.text);

		// Oversized pipe table → row-boundary slices with the header repeated; no overlap.
		if (block.kind === 'table' && blockTokens > this.chunkTokens) {
			this.emitTableSlices(block);
			return;
		}

		// A single non-table block longer than a whole window → hard-split pieces that then
		// pack like ordinary blocks.
		const pieces: IBlock[] =
			blockTokens > this.chunkTokens ? hardSplitBlock(block, this.chunkTokens, this.counter) : [block];

		for (const piece of pieces) {
			this.pack(piece);
		}
	}

	/**
	 * Emits the accumulated window as one chunk (overlap prefix + anchored source slice) and
	 * arms the overlap tail for the next chunk. A no-op when nothing is accumulated.
	 */
	flush(): void {
		if (!this.window.length) {
			return;
		}
		const anchor = this.window[0];
		const end = this.window[this.window.length - 1].end;
		const slice = this.source.slice(anchor.start, end);
		const content = this.pendingOverlap ? `${this.pendingOverlap}\n\n${slice}` : slice;
		this.chunks.push({
			chunkIndex: this.chunks.length,
			content,
			tokenCount: this.counter.count(content),
			metadata: locatorMetadata(anchor, anchor.start, end)
		});
		this.pendingOverlap = this.overlapTokens > 0 ? takeTailByTokens(slice, this.overlapTokens, this.counter) : '';
		this.window = [];
		this.windowTokens = 0;
	}

	/**
	 * Greedily adds one window-sized piece, flushing the current window first once the piece no
	 * longer fits into it.
	 */
	private pack(piece: IBlock): void {
		const pieceTokens = this.counter.count(piece.text);
		if (this.window.length && this.windowTokens + pieceTokens > this.chunkTokens) {
			this.flush();
		}
		this.window.push(piece);
		this.windowTokens += pieceTokens;
	}

	/**
	 * Flushes the window, then emits one chunk per row-boundary slice of an oversized table.
	 * Table slices deliberately carry no generic overlap — the repeated header is their context.
	 */
	private emitTableSlices(block: IBlock): void {
		this.flush();
		this.pendingOverlap = '';
		for (const slice of sliceTable(block, this.chunkTokens, this.counter)) {
			this.chunks.push({
				chunkIndex: this.chunks.length,
				content: slice.content,
				tokenCount: this.counter.count(slice.content),
				metadata: locatorMetadata(block, slice.start, slice.end)
			});
		}
	}
}

/** One level of the enclosing-heading stack. */
interface IHeadingEntry {
	level: number;
	text: string;
}

/** The locator state carried line by line through `splitBlocks` (§4.1). */
interface ILocatorState {
	headingStack: IHeadingEntry[];
	page: number | null;
	sheet: string | null;
}

/**
 * Snapshots the locator state onto a block. The heading path is copied out of the stack — the
 * stack itself keeps mutating as the document is walked.
 */
function locatorSnapshot(state: ILocatorState): Pick<IBlock, 'headingPath' | 'page' | 'sheet'> {
	return {
		headingPath: state.headingStack.map((entry) => entry.text),
		page: state.page,
		sheet: state.sheet
	};
}

/**
 * End offset of the block that closes on the line before `lineStart`: the LF preceding the
 * boundary line is not part of it, except at the very start of the document where none exists.
 */
function blockEndBefore(lineStart: number): number {
	return lineStart > 0 ? lineStart - 1 : lineStart;
}

/**
 * A run of at least two lines that all start with a pipe is a markdown table (an oversized one
 * later slices on row boundaries); anything else is an ordinary paragraph.
 */
function paragraphKind(paraLines: string[]): IBlock['kind'] {
	const isTable = paraLines.length >= 2 && paraLines.every((line) => line.trimStart().startsWith('|'));
	return isTable ? 'table' : 'paragraph';
}

/**
 * Applies one heading line to the locator state. The §4.1 locator headings (`## Page N`,
 * `## Sheet: <name>`) set `page`/`sheet` and are deliberately excluded from `headingPath`;
 * every other heading pops the stack down to its own level and then pushes itself.
 */
function applyHeadingLine(line: string, headingMatch: RegExpExecArray, state: ILocatorState): void {
	const pageMatch = PAGE_HEADING.exec(line);
	if (pageMatch) {
		state.page = Number.parseInt(pageMatch[1], 10);
		return;
	}

	const sheetMatch = SHEET_HEADING.exec(line);
	if (sheetMatch) {
		state.sheet = sheetMatch[1];
		return;
	}

	const level = headingMatch.groups.hashes.length;
	const stack = state.headingStack;
	while (stack.length && stack[stack.length - 1].level >= level) {
		stack.pop();
	}
	stack.push({ level, text: headingMatch.groups.text.trim() });
}

/**
 * Splits normalized markdown into blocks at heading lines and blank-line boundaries,
 * tracking the enclosing-heading stack and the page/sheet locator state per block.
 */
function splitBlocks(source: string): IBlock[] {
	const blocks: IBlock[] = [];
	const locators: ILocatorState = { headingStack: [], page: null, sheet: null };

	const lines = source.split('\n');
	let offset = 0;

	/** Current paragraph accumulation. */
	let paraStart = -1;
	let paraLines: string[] = [];

	const flushParagraph = (endOffset: number): void => {
		if (paraStart >= 0 && paraLines.length) {
			blocks.push({
				text: paraLines.join('\n'),
				start: paraStart,
				end: endOffset,
				kind: paragraphKind(paraLines),
				...locatorSnapshot(locators)
			});
		}
		paraStart = -1;
		paraLines = [];
	};

	for (const line of lines) {
		const lineStart = offset;
		const lineEnd = offset + line.length;
		offset = lineEnd + 1; // account for the LF

		const headingMatch = MARKDOWN_HEADING.exec(line);
		if (headingMatch) {
			flushParagraph(blockEndBefore(lineStart));
			// The locator update runs BEFORE the snapshot: a heading block carries its own path.
			applyHeadingLine(line, headingMatch, locators);
			blocks.push({
				text: line,
				start: lineStart,
				end: lineEnd,
				kind: 'heading',
				...locatorSnapshot(locators)
			});
			continue;
		}

		if (!line.trim()) {
			flushParagraph(blockEndBefore(lineStart));
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
