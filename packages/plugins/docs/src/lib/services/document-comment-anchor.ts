import * as Y from 'yjs';
import {
	DocumentCommentAnchorMethodEnum,
	DocumentCommentAnchorStatusEnum,
	IDocumentCommentAnchorInput,
	IDocumentCommentAnchorPosition
} from '@gauzy/contracts';
import { LIVE_FRAGMENT } from '../live/document-live.yjs';

/**
 * Text-range anchors of page comments (`docs-collaboration` plan, §4 "Comment anchors").
 *
 * Pure: the page's JSON (or its shared document) in, where each anchor is now out. The same rules are written in the
 * clients (docs-ui, Ever Teams) for the page open in the editor, so a range is found alike everywhere:
 *
 * 1. the live relative positions, when the anchor has them and the page has a live state;
 * 2. the block's text at the stored offsets, when it still is the quote;
 * 3. the quote in the block (the occurrence whose context and place fit best), then in the other blocks;
 * 4. the quote with small differences in the block (an approximate match, at most a quarter of it edited);
 * 5. the block alone; else the anchor is orphaned.
 */

/** The longest quote an anchor keeps. */
export const DOCS_ANCHOR_QUOTE_MAX_LENGTH = 1000;
/** The longest context (`prefix` / `suffix`) an anchor keeps. */
export const DOCS_ANCHOR_CONTEXT_MAX_LENGTH = 32;
/** The longest relative position (base64) an anchor keeps. */
export const DOCS_ANCHOR_RELATIVE_MAX_LENGTH = 512;
/** An approximate match is looked for only for quotes of at least this length (a shorter one is too ambiguous). */
export const DOCS_ANCHOR_FUZZY_MIN_LENGTH = 6;
/** The approximate match compares at most this many characters of the quote (its beginning). */
export const DOCS_ANCHOR_FUZZY_MAX_LENGTH = 256;
/** The approximate match reads at most this many characters of a block. */
export const DOCS_ANCHOR_FUZZY_MAX_TEXT = 20_000;
/** At most this share of an approximate match may differ from the quote. */
export const DOCS_ANCHOR_FUZZY_MAX_ERROR_RATE = 0.25;
/** A long quote is compared in full at the closest this many places its beginning may start. */
export const DOCS_ANCHOR_FUZZY_MAX_CANDIDATES = 8;
/**
 * The approximate-match work (cells of the comparison) one read of a page's anchors may spend in all: a page with many
 * long quotes that are gone from long blocks falls back to the blocks rather than hold the read.
 */
export const DOCS_ANCHOR_FUZZY_BUDGET = 20_000_000;

/** A JSON node of a page. */
export interface IAnchorJsonNode {
	type?: string;
	attrs?: Record<string, unknown> | null;
	content?: IAnchorJsonNode[] | null;
	text?: string | null;
}

/** A block of a page: a node with a `blockId`, and its text. */
export interface IAnchorBlock {
	blockId: string;
	text: string;
}

/** The text of a node: every text node under it, in order, with nothing between them. */
export function blockTextOf(node: IAnchorJsonNode | null | undefined): string {
	if (!node || typeof node !== 'object') return '';
	if (node.type === 'text') return typeof node.text === 'string' ? node.text : '';
	if (!Array.isArray(node.content)) return '';
	let text = '';
	for (const child of node.content) text += blockTextOf(child);
	return text;
}

/**
 * The blocks of a page, in document order (an outer block before the blocks inside it). A `blockId` met twice (a
 * copied block) is the first one's.
 */
export function anchorBlocksOf(contentJson: unknown): IAnchorBlock[] {
	const blocks: IAnchorBlock[] = [];
	const seen = new Set<string>();
	const visit = (node: IAnchorJsonNode | null | undefined): void => {
		if (!node || typeof node !== 'object') return;
		const blockId = node.attrs && typeof node.attrs['blockId'] === 'string' ? (node.attrs['blockId'] as string) : null;
		if (blockId && !seen.has(blockId)) {
			seen.add(blockId);
			blocks.push({ blockId, text: blockTextOf(node) });
		}
		if (Array.isArray(node.content)) for (const child of node.content) visit(child);
	};
	visit(docOf(contentJson));
	return blocks;
}

/** The document of a stored column value (the JSON may be text on SQLite). */
function docOf(contentJson: unknown): IAnchorJsonNode | null {
	if (typeof contentJson === 'string') {
		try {
			return JSON.parse(contentJson) as IAnchorJsonNode;
		} catch {
			return null;
		}
	}
	return contentJson && typeof contentJson === 'object' ? (contentJson as IAnchorJsonNode) : null;
}

/** Where a live relative position is: a block and an offset into its text. */
export interface ILiveAnchorPoint {
	blockId: string;
	offset: number;
}

/** Reads the relative positions of an anchor in a page's shared document. */
export type LiveAnchorResolver = (relative: string) => ILiveAnchorPoint | null;

/** The absolute position of a base64 relative position in `doc`; null for bytes that are not one. */
function absolutePositionOf(doc: Y.Doc, relative: string): Y.AbsolutePosition | null {
	try {
		const bytes = Buffer.from(relative, 'base64');
		if (!bytes.length) return null;
		return Y.createAbsolutePositionFromRelativePosition(Y.decodeRelativePosition(new Uint8Array(bytes)), doc);
	} catch {
		return null;
	}
}

/**
 * The resolver of relative positions in a page's shared document (fragment `default`, as y-prosemirror binds it).
 *
 * A position the document does not know yet (made on edits the stored state does not hold), one that is not inside
 * a block with a `blockId`, or bytes that are not a relative position, are `null`.
 */
export function liveAnchorResolverOf(doc: Y.Doc): LiveAnchorResolver {
	const fragment = doc.getXmlFragment(LIVE_FRAGMENT);
	return (relative: string): ILiveAnchorPoint | null => {
		const absolute = absolutePositionOf(doc, relative);
		if (!absolute || !isInside(absolute.type, fragment)) return null;
		return pointOf(absolute.type, absolute.index);
	};
}

/** Whether a type is the fragment or under it. */
function isInside(type: Y.AbstractType<any>, fragment: Y.XmlFragment): boolean {
	for (let current: Y.AbstractType<any> | null = type; current; current = parentOf(current)) {
		if (current === fragment) return true;
	}
	return false;
}

function parentOf(type: Y.AbstractType<any>): Y.AbstractType<any> | null {
	const parent = (type as unknown as { parent?: Y.AbstractType<any> | null }).parent;
	return parent ?? null;
}

/**
 * The text length of a shared-document node, as {@link blockTextOf} counts it: a text's characters (y-prosemirror
 * writes inline nodes as elements, never as embeds), an element's children's.
 */
function liveTextLength(type: unknown): number {
	if (type instanceof Y.XmlText) return type.length;
	if (type instanceof Y.XmlElement || type instanceof Y.XmlFragment) {
		let length = 0;
		for (const child of type.toArray()) length += liveTextLength(child);
		return length;
	}
	return 0;
}

/**
 * The block and offset of `(type, index)`: the nearest element with a `blockId` above the position, and the text
 * before the position inside it.
 */
function pointOf(type: Y.AbstractType<any>, index: number): ILiveAnchorPoint | null {
	// The text before the position inside `type` itself.
	let offset = 0;
	if (type instanceof Y.XmlText) {
		offset = Math.max(0, Math.min(index, type.length));
	} else if (type instanceof Y.XmlElement || type instanceof Y.XmlFragment) {
		const children = type.toArray();
		for (let at = 0; at < Math.min(index, children.length); at += 1) offset += liveTextLength(children[at]);
	} else {
		return null;
	}
	// Up the tree to the block, adding the text of the siblings before each step.
	let node: Y.AbstractType<any> = type;
	for (;;) {
		if (node instanceof Y.XmlElement) {
			const blockId = node.getAttribute('blockId');
			if (typeof blockId === 'string' && blockId.length > 0) return { blockId, offset };
		}
		const parent = parentOf(node);
		if (!parent || !(parent instanceof Y.XmlElement || parent instanceof Y.XmlFragment)) return null;
		for (const sibling of parent.toArray()) {
			if (sibling === node) break;
			offset += liveTextLength(sibling);
		}
		node = parent;
	}
}

/**
 * Where an anchor is in the page as it is now.
 *
 * @param anchor The stored anchor.
 * @param blocks The page's blocks ({@link anchorBlocksOf}).
 * @param live The page's live relative positions, when it has a live state.
 */
export function resolveCommentAnchor(
	anchor: IDocumentCommentAnchorInput,
	blocks: readonly IAnchorBlock[],
	live?: LiveAnchorResolver | null,
	budget?: { cells: number } | null
): IDocumentCommentAnchorPosition {
	const quote = String(anchor.quote ?? '');
	const byId = new Map(blocks.map((block) => [block.blockId, block]));
	const own = byId.get(anchor.blockId) ?? null;

	// 1. The live positions follow every edit: their range is the comment's even when its text was edited.
	if (live && anchor.relativeStart && anchor.relativeEnd) {
		const from = live(anchor.relativeStart);
		const to = live(anchor.relativeEnd);
		const block = from ? byId.get(from.blockId) : undefined;
		if (from && to && block && from.blockId === to.blockId && to.offset > from.offset && to.offset <= block.text.length) {
			const text = block.text.slice(from.offset, to.offset);
			return position(text === quote ? DocumentCommentAnchorStatusEnum.EXACT : DocumentCommentAnchorStatusEnum.MOVED, DocumentCommentAnchorMethodEnum.RELATIVE, block.blockId, from.offset, to.offset, text);
		}
	}

	if (quote.length > 0) {
		// 2. The offsets, when they still cover the quote.
		const start = Number(anchor.start);
		const end = Number(anchor.end);
		if (own && Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end <= own.text.length && own.text.slice(start, end) === quote) {
			return position(DocumentCommentAnchorStatusEnum.EXACT, DocumentCommentAnchorMethodEnum.OFFSETS, own.blockId, start, end, quote);
		}
		// 3. The quote, in its block first.
		if (own) {
			const at = bestOccurrence(own.text, quote, anchor, Number.isInteger(start) ? start : null);
			if (at !== null) return position(DocumentCommentAnchorStatusEnum.MOVED, DocumentCommentAnchorMethodEnum.QUOTE, own.blockId, at, at + quote.length, quote);
		}
		// … then in the other blocks: the one whose context fits best, the first of equals.
		let best: { block: IAnchorBlock; at: number; score: number } | null = null;
		for (const block of blocks) {
			if (block === own || block.text.length < quote.length) continue;
			const at = bestOccurrence(block.text, quote, anchor, null);
			if (at === null) continue;
			const score = contextScore(block.text, at, quote.length, anchor);
			if (!best || score > best.score) best = { block, at, score };
		}
		if (best) return position(DocumentCommentAnchorStatusEnum.MOVED, DocumentCommentAnchorMethodEnum.QUOTE, best.block.blockId, best.at, best.at + quote.length, quote);
		// 4. The quote with small differences, in its block, while the read's work budget lasts.
		if (own && spendFuzzyWork(budget, quote, own.text)) {
			const match = approximateMatch(own.text, quote);
			if (match) return position(DocumentCommentAnchorStatusEnum.MOVED, DocumentCommentAnchorMethodEnum.FUZZY, own.blockId, match.start, match.end, own.text.slice(match.start, match.end));
		}
	}

	// 5. The block alone.
	if (own) return position(DocumentCommentAnchorStatusEnum.BLOCK, DocumentCommentAnchorMethodEnum.BLOCK, own.blockId, null, null, null);
	return position(DocumentCommentAnchorStatusEnum.ORPHANED, null, null, null, null, null);
}

function position(
	status: DocumentCommentAnchorStatusEnum,
	method: DocumentCommentAnchorMethodEnum | null,
	blockId: string | null,
	start: number | null,
	end: number | null,
	text: string | null
): IDocumentCommentAnchorPosition {
	return { status, method, blockId, start, end, text };
}

/** Every start of `quote` in `text`. */
export function occurrencesOf(text: string, quote: string): number[] {
	const found: number[] = [];
	if (!quote) return found;
	for (let at = text.indexOf(quote); at >= 0; at = text.indexOf(quote, at + 1)) found.push(at);
	return found;
}

/** How well the text around an occurrence matches the anchor's prefix and suffix (characters in common). */
function contextScore(text: string, at: number, length: number, anchor: Pick<IDocumentCommentAnchorInput, 'prefix' | 'suffix'>): number {
	const prefix = anchor.prefix ?? '';
	const suffix = anchor.suffix ?? '';
	let score = 0;
	for (let n = 1; n <= prefix.length && at - n >= 0 && text[at - n] === prefix[prefix.length - n]; n += 1) score += 1;
	for (let n = 0; n < suffix.length && at + length + n < text.length && text[at + length + n] === suffix[n]; n += 1) score += 1;
	return score;
}

/**
 * The occurrence of `quote` in `text` that fits best: the most context in common, then the nearest to where the
 * range was (`near`), then the first.
 */
function bestOccurrence(text: string, quote: string, anchor: Pick<IDocumentCommentAnchorInput, 'prefix' | 'suffix'>, near: number | null): number | null {
	const found = occurrencesOf(text, quote);
	if (!found.length) return null;
	let best = found[0];
	let bestScore = contextScore(text, best, quote.length, anchor);
	for (const at of found.slice(1)) {
		const score = contextScore(text, at, quote.length, anchor);
		const closer = near !== null && Math.abs(at - near) < Math.abs(best - near);
		if (score > bestScore || (score === bestScore && closer)) {
			best = at;
			bestScore = score;
		}
	}
	return best;
}

/**
 * The substring of `text` closest to `quote` by edit distance (insertions, deletions, substitutions), when at most
 * {@link DOCS_ANCHOR_FUZZY_MAX_ERROR_RATE} of the quote differs. Of equally close substrings, the first, run on for as
 * long as it stays as close.
 *
 * A quote longer than {@link DOCS_ANCHOR_FUZZY_MAX_LENGTH} is looked for by its beginning, which gives the places it
 * may start; each of the closest few ({@link DOCS_ANCHOR_FUZZY_MAX_CANDIDATES}) is then compared with the whole quote,
 * its end free within the error rate (text inserted or removed in the tail moves it), and the closest one wins.
 */
export function approximateMatch(text: string, quote: string): { start: number; end: number; distance: number } | null {
	if (quote.length < DOCS_ANCHOR_FUZZY_MIN_LENGTH || !text) return null;
	const pattern = quote.slice(0, DOCS_ANCHOR_FUZZY_MAX_LENGTH);
	const haystack = text.slice(0, DOCS_ANCHOR_FUZZY_MAX_TEXT);
	const m = pattern.length;
	const limit = Math.floor(m * DOCS_ANCHOR_FUZZY_MAX_ERROR_RATE);
	const whole = quote.length === pattern.length;
	// A long quote's beginning may hold more of its edits than a quarter of the beginning: a start is admitted within the
	// whole quote's limit, and the whole-quote comparison below decides.
	const admit = whole ? limit : Math.min(m, Math.floor(quote.length * DOCS_ANCHOR_FUZZY_MAX_ERROR_RATE));
	// Sellers' algorithm: a match may start anywhere (row 0 is all zeroes); each cell keeps where its match started.
	let cost = new Array<number>(m + 1);
	let from = new Array<number>(m + 1);
	for (let i = 0; i <= m; i += 1) {
		cost[i] = i;
		from[i] = 0;
	}
	let best: { start: number; end: number; distance: number } | null = null;
	/** For a long quote: each place its beginning may start, with the closest distance found there. */
	const starts = new Map<number, number>();
	for (let j = 1; j <= haystack.length; j += 1) {
		const nextCost = new Array<number>(m + 1);
		const nextFrom = new Array<number>(m + 1);
		nextCost[0] = 0;
		nextFrom[0] = j;
		for (let i = 1; i <= m; i += 1) {
			const substitution = cost[i - 1] + (pattern[i - 1] === haystack[j - 1] ? 0 : 1);
			const deletion = cost[i] + 1; // a character of the text that the quote has not
			const insertion = nextCost[i - 1] + 1; // a character of the quote that the text has not
			if (substitution <= deletion && substitution <= insertion) {
				nextCost[i] = substitution;
				nextFrom[i] = from[i - 1];
			} else if (insertion <= deletion) {
				nextCost[i] = insertion;
				nextFrom[i] = nextFrom[i - 1];
			} else {
				nextCost[i] = deletion;
				nextFrom[i] = from[i];
			}
		}
		cost = nextCost;
		from = nextFrom;
		if (!whole) {
			if (cost[m] <= admit && cost[m] < (starts.get(from[m]) ?? Infinity)) starts.set(from[m], cost[m]);
			continue;
		}
		if (cost[m] <= limit && (!best || cost[m] < best.distance)) {
			best = { start: from[m], end: j, distance: cost[m] };
			if (cost[m] === 0) break;
		} else if (best && cost[m] === best.distance && from[m] === best.start && j === best.end + 1) {
			// As close and from the same start, one character on: the longer match covers the quote's tail too.
			best.end = j;
		}
	}
	if (whole) return best && best.end > best.start ? best : null;
	// The closest starts, each compared with the whole quote: the closest whole run wins (of equals, the first).
	const fullLimit = Math.floor(quote.length * DOCS_ANCHOR_FUZZY_MAX_ERROR_RATE);
	const candidates = [...starts.entries()]
		.sort(([startA, distanceA], [startB, distanceB]) => distanceA - distanceB || startA - startB)
		.slice(0, DOCS_ANCHOR_FUZZY_MAX_CANDIDATES);
	let found: { start: number; end: number; distance: number } | null = null;
	for (const [start] of candidates) {
		const run = closestRunFrom(text, start, quote, fullLimit);
		if (run && (!found || run.distance < found.distance || (run.distance === found.distance && start < found.start))) {
			found = { start, end: start + run.length, distance: run.distance };
		}
	}
	return found;
}

/**
 * The run of `text` from `start` closest to the whole `quote` (its end free: text inserted or removed in it moves the
 * end), when at most `limit` edits apart; of equally close ends, the one nearest the quote's own length. Only a band
 * of `limit` cells around the diagonal is computed, so it costs O(|quote| · limit).
 */
export function closestRunFrom(text: string, start: number, quote: string, limit: number): { length: number; distance: number } | null {
	if (limit < 0 || start < 0) return null;
	const run = text.slice(start, start + quote.length + limit);
	if (run.length < quote.length - limit) return null;
	const beyond = limit + 1;
	// previous[j]: the distance between the quote's first i characters and the run's first j.
	let previous = new Array<number>(run.length + 1);
	for (let j = 0; j <= run.length; j += 1) previous[j] = j <= limit ? j : beyond;
	for (let i = 1; i <= quote.length; i += 1) {
		const current = new Array<number>(run.length + 1).fill(beyond);
		current[0] = i <= limit ? i : beyond;
		let rowBest = current[0];
		for (let j = Math.max(1, i - limit); j <= Math.min(run.length, i + limit); j += 1) {
			const cost = Math.min(previous[j - 1] + (quote[i - 1] === run[j - 1] ? 0 : 1), previous[j] + 1, current[j - 1] + 1);
			current[j] = Math.min(cost, beyond);
			if (current[j] < rowBest) rowBest = current[j];
		}
		if (rowBest > limit) return null;
		previous = current;
	}
	let best: { length: number; distance: number } | null = null;
	for (let j = Math.max(1, quote.length - limit); j <= Math.min(run.length, quote.length + limit); j += 1) {
		const distance = previous[j];
		if (distance > limit) continue;
		if (!best || distance < best.distance || (distance === best.distance && Math.abs(j - quote.length) < Math.abs(best.length - quote.length))) {
			best = { length: j, distance };
		}
	}
	return best;
}

/**
 * Takes the work of one approximate match out of `budget` (a quote too short for one costs nothing); false when what is
 * left does not cover it. Without a budget the work is not counted.
 */
function spendFuzzyWork(budget: { cells: number } | null | undefined, quote: string, text: string): boolean {
	if (!budget || quote.length < DOCS_ANCHOR_FUZZY_MIN_LENGTH) return true;
	let cost = Math.min(quote.length, DOCS_ANCHOR_FUZZY_MAX_LENGTH) * Math.min(text.length, DOCS_ANCHOR_FUZZY_MAX_TEXT);
	// A long quote's few closest starts are each compared with the whole quote too.
	if (quote.length > DOCS_ANCHOR_FUZZY_MAX_LENGTH) {
		cost += DOCS_ANCHOR_FUZZY_MAX_CANDIDATES * quote.length * (2 * Math.floor(quote.length * DOCS_ANCHOR_FUZZY_MAX_ERROR_RATE) + 1);
	}
	if (cost > budget.cells) return false;
	budget.cells -= cost;
	return true;
}

/** The context an editor stores beside a quote: the text right before and after the range. */
export function anchorContextOf(text: string, start: number, end: number): { prefix: string; suffix: string } {
	return {
		prefix: text.slice(Math.max(0, start - DOCS_ANCHOR_CONTEXT_MAX_LENGTH), start),
		suffix: text.slice(end, end + DOCS_ANCHOR_CONTEXT_MAX_LENGTH)
	};
}
