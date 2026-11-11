import { ID } from './base-entity.model';

/**
 * Where a comment of a Docs page sits in the page's text: a range of one block's text.
 *
 * A block is a node of the page's TipTap JSON that carries a `blockId` attribute; its **text** is the concatenation of
 * the `text` of every text node under it, in document order, with nothing between them (an inline atom such as a
 * mention or a hard break adds nothing). `start` and `end` are UTF-16 offsets into that text (`end` excluded), the
 * offsets `String.prototype.slice` takes.
 *
 * The quote is the text the range covered when the comment was made: when the page is edited and the offsets no
 * longer cover it, the platform finds the quote again (in the block first, then in the page, then approximately) and
 * otherwise falls back to the block. `prefix` and `suffix` (a few characters before and after the range) tell two
 * equal quotes apart.
 *
 * `relativeStart` / `relativeEnd` are set by an editor in a live session (`GAUZY_DOCS_LIVE_ENABLED`): base64 of
 * `Y.encodeRelativePosition` for the range's ends in the page's shared document (fragment `default`). They follow
 * every concurrent edit, so they are read first when the page has a live state.
 */
export interface IDocumentCommentAnchorInput {
	/** The block the range is in (its `blockId` attribute). */
	blockId: string;
	/** The range's first character in the block's text. */
	start: number;
	/** The range's end in the block's text (excluded); `end >= start`. */
	end: number;
	/** The text the range covered, as the author saw it. */
	quote: string;
	/** Up to 32 characters of the block's text before the range. */
	prefix?: string | null;
	/** Up to 32 characters of the block's text after the range. */
	suffix?: string | null;
	/** Base64 `Y.RelativePosition` of `start` in the page's shared document (live sessions only). */
	relativeStart?: string | null;
	/** Base64 `Y.RelativePosition` of `end` in the page's shared document (live sessions only). */
	relativeEnd?: string | null;
}

/** A stored anchor: the range a comment was made on (`document_comment_anchor`, one per comment). */
export interface IDocumentCommentAnchor extends IDocumentCommentAnchorInput {
	id?: ID;
	commentId: ID;
	documentId: ID;
	tenantId?: ID;
	organizationId?: ID;
	createdAt?: Date;
	updatedAt?: Date;
}

/**
 * How an anchor was found again in the page as it is now:
 * - `exact`: the range still covers the quote (by its offsets, or by its live relative positions);
 * - `moved`: the quote was found elsewhere (in the block, in another block, or approximately);
 * - `block`: the quote is gone but the block is there: the comment is on the block;
 * - `orphaned`: neither the quote nor the block is in the page.
 */
export enum DocumentCommentAnchorStatusEnum {
	EXACT = 'exact',
	MOVED = 'moved',
	BLOCK = 'block',
	ORPHANED = 'orphaned'
}

/** What found an anchor again. */
export enum DocumentCommentAnchorMethodEnum {
	/** The stored offsets still cover the quote. */
	OFFSETS = 'offsets',
	/** The relative positions in the page's shared document (live sessions). */
	RELATIVE = 'relative',
	/** The quote, found as it was. */
	QUOTE = 'quote',
	/** The quote, found with small differences. */
	FUZZY = 'fuzzy',
	/** Nothing but the block. */
	BLOCK = 'block'
}

/** Where an anchor is in the page now (`start` / `end` are offsets into the block's text, `null` without a range). */
export interface IDocumentCommentAnchorPosition {
	status: DocumentCommentAnchorStatusEnum;
	method: DocumentCommentAnchorMethodEnum | null;
	blockId: string | null;
	start: number | null;
	end: number | null;
	/** The text the range covers now (`null` without a range). */
	text: string | null;
}

/** A stored anchor with where it is now. */
export interface IDocumentCommentAnchorResolved extends IDocumentCommentAnchor {
	position: IDocumentCommentAnchorPosition;
}

/** The anchors of a page's comments, each found again in the page as it is now. */
export interface IDocumentCommentAnchorList {
	documentId: ID;
	/** The page's `contentRevision` the positions were computed on. */
	revision: number;
	/** Whether the positions were computed on the page's live state (`contentBinary`) rather than its JSON. */
	live: boolean;
	items: IDocumentCommentAnchorResolved[];
}

/** One match of a search term in a snippet: `[start, end)` UTF-16 offsets into the snippet's `text`. */
export interface IDocumentSearchMatchRange {
	start: number;
	end: number;
}

/** Which text of a document a search snippet was cut from. */
export enum DocumentSearchSnippetSourceEnum {
	/** The page's text (its TipTap JSON, or its HTML cache when it has no JSON). */
	CONTENT = 'content',
	/** A file's extracted text. */
	EXTRACTED_TEXT = 'extractedText',
	/** The description. */
	DESCRIPTION = 'description',
	/** Nothing matched in the text (the name did): the beginning of the text, without matches. */
	LEADING = 'leading'
}

/**
 * The plain-text snippet of a document found by a search (`GET /plugins/docs/documents?q=…`): about 160 characters
 * around the first match, with the matches as offsets — never HTML, so a client marks them up its own way.
 */
export interface IDocumentSearchSnippet {
	source: DocumentSearchSnippetSourceEnum;
	/** The snippet, whitespace collapsed, cut at word boundaries. */
	text: string;
	/** Every match of the term inside `text`, in order. */
	matches: IDocumentSearchMatchRange[];
	/** The matches of the term in the document's name. */
	nameMatches: IDocumentSearchMatchRange[];
	/** Whether text was cut before the snippet (a client shows an ellipsis). */
	truncatedStart: boolean;
	/** Whether text was cut after the snippet. */
	truncatedEnd: boolean;
}
