import { Editor, Extension } from '@tiptap/core';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { type EditorState, Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { IDocumentCommentAnchorPosition } from '@gauzy/contracts';
import {
	DOCS_ANCHOR_FUZZY_BUDGET,
	type ICommentRange,
	type LiveAnchorResolver,
	resolveCommentAnchor
} from '../comments/comment-anchor.model';
import { editorBlocksOf, positionOfTextOffset } from './comment-ranges';

/**
 * Block-comment markers (spec 05 §8) and comment ranges (`docs-collaboration` FR-16).
 *
 * Comments are core `Comment` rows anchored to the UniqueID `blockId`; this extension is the
 * editor-side half: it decorates every block that has an **open** thread with a gutter marker
 * and a class, and the marker opens that thread in the page's Comments rail. It holds no
 * comment data of its own — the rail owns the fetch and pushes the anchor set in with
 * `setCommentedBlocks()`, so there is exactly one source of truth for "which blocks have
 * comments" and no second request.
 *
 * A thread made on selected text also has a range (the platform's comment anchor). The rail
 * pushes those in with `setCommentRanges()`: each is found again in the document as it is now
 * (`comment-anchor.model.ts`, the platform's rules) and its text is highlighted — a decoration,
 * never a mark, so the page's content is unchanged. A click on a highlight opens its thread.
 * While the page is typed in, the highlights move with the text, and the ranges are found again
 * a moment after the last edit (live, by their relative positions in the shared document).
 */

/** Carries the plugin's state, and (as an array of block ids) the transaction meta that sets the open blocks. */
export const blockCommentsPluginKey = new PluginKey<IBlockCommentsState>('gzBlockComments');

/** The transaction meta that sets the ranges (and the lit thread). */
const COMMENT_RANGES_META = 'gzCommentRanges';
/** The transaction meta that finds the ranges again after edits. */
const REFRESH_RANGES_META = 'gzCommentRangesRefresh';

/** How long after the last edit the ranges are found again (meanwhile their highlights move with the text). */
export const COMMENT_RANGES_REFRESH_MS = 150;

/** The attribute UniqueID is configured to write (`document-extensions.ts`). */
export const BLOCK_ID_ATTRIBUTE = 'blockId';

export interface IBlockCommentsOptions {
	/**
	 * Invoked when a gutter marker or a highlighted range is activated: the block whose threads to show, and for a
	 * range, its thread.
	 */
	onOpenThread: (blockId: string, threadId?: string) => void;
	/** Accessible name for the marker button — resolved by the caller (this file has no i18n). */
	markerLabel: string;
	/** Comment on the selection (Mod-Alt-M). */
	onComment?: () => void;
	/** The live relative positions of the page's shared document, while it is edited live. */
	liveResolver?: () => LiveAnchorResolver | null;
	/** Where each range thread is now, each time the ranges are found again (the rail shows the text it covers now). */
	onRangesResolved?: (places: ReadonlyMap<string, IDocumentCommentAnchorPosition>) => void;
}

/** The plugin's state: what the rail pushed in, and what it draws. */
export interface IBlockCommentsState {
	/** The blocks with an open thread that has no range. */
	open: readonly string[];
	/** The open threads on a range of text, oldest first. */
	ranges: readonly ICommentRange[];
	/** The thread whose range is lit. */
	activeThread: string | null;
	decorations: DecorationSet;
	/** Where each range thread is now, by thread (as of the last time the ranges were found). */
	places: ReadonlyMap<string, IDocumentCommentAnchorPosition>;
	/** The document changed since the ranges were found: the highlights were moved with it, not found again. */
	stale: boolean;
}

/** What a range's highlight carries: the thread it opens, and the block the rail lists it under. */
interface IRangeSpec {
	threadId: string;
	blockId: string;
}

const NO_PLACES: ReadonlyMap<string, IDocumentCommentAnchorPosition> = new Map();

/**
 * The `blockId` of the innermost block containing the selection.
 *
 * Walks outwards from the selection head so a caret inside a list item or a table cell
 * anchors to the nearest block that actually carries an id, rather than failing because the
 * deepest node is a text node with no attributes.
 *
 * @param editor The live editor.
 * @returns The block id, or `null` when nothing in the ancestor chain has one.
 */
export function enclosingBlockId(editor: Editor | null | undefined): string | null {
	const selection = editor?.state?.selection;
	if (!selection) return null;
	const { $from } = selection;
	for (let depth = $from.depth; depth > 0; depth -= 1) {
		const id = $from.node(depth).attrs?.[BLOCK_ID_ATTRIBUTE];
		if (typeof id === 'string' && id) return id;
	}
	return null;
}

/**
 * Every `blockId` present in the document, in document order.
 *
 * The rail uses it to tell a live thread from a detached one — a comment whose block was
 * deleted stays readable but is flagged `DOCS.EDITOR.COMMENT.DETACHED` (spec 05 §8).
 */
export function collectBlockIds(editor: Editor | null | undefined): string[] {
	const doc = editor?.state?.doc;
	if (!doc) return [];
	const ids: string[] = [];
	doc.descendants((node: ProseMirrorNode) => {
		const id = node.attrs?.[BLOCK_ID_ATTRIBUTE];
		if (typeof id === 'string' && id) ids.push(id);
		return true;
	});
	return ids;
}

/**
 * Publishes the set of blocks with an open thread.
 *
 * Dispatched as transaction meta rather than written to a field: ProseMirror re-derives the
 * decorations from plugin state, so this is what makes a resolved comment's marker disappear
 * without touching the document (resolving must never mutate content — spec 05 §8).
 */
export function setCommentedBlocks(editor: Editor | null | undefined, blockIds: readonly string[]): void {
	if (!editor || editor.isDestroyed) return;
	const { view } = editor;
	view.dispatch(view.state.tr.setMeta(blockCommentsPluginKey, [...blockIds]));
}

/**
 * Publishes the open threads made on a range of text: their text is highlighted. As meta, never as a document change.
 *
 * @param editor The live editor.
 * @param ranges The threads' ranges, oldest first.
 */
export function setCommentRanges(editor: Editor | null | undefined, ranges: readonly ICommentRange[]): void {
	dispatchRangesMeta(editor, { ranges: [...ranges] });
}

/** Lights one thread's range (or none). */
export function setActiveCommentThread(editor: Editor | null | undefined, threadId: string | null): void {
	dispatchRangesMeta(editor, { activeThread: threadId });
}

function dispatchRangesMeta(
	editor: Editor | null | undefined,
	meta: Partial<Pick<IBlockCommentsState, 'ranges' | 'activeThread'>>
): void {
	if (!editor || editor.isDestroyed) return;
	const { view } = editor;
	view.dispatch(view.state.tr.setMeta(COMMENT_RANGES_META, meta).setMeta('addToHistory', false));
}

/** The plugin's state of an editor state (null without the plugin). */
export function blockCommentsStateOf(state: EditorState | null | undefined): IBlockCommentsState | null {
	return (state && blockCommentsPluginKey.getState(state)) ?? null;
}

function isRangeSpec(spec: unknown): spec is IRangeSpec {
	return typeof (spec as Partial<IRangeSpec> | null)?.threadId === 'string';
}

/** The highlighted range at a position (the shortest of those around it), when there is one. */
export function commentRangeAt(state: EditorState, pos: number): IRangeSpec | null {
	const decorations = blockCommentsStateOf(state)?.decorations;
	if (!decorations) return null;
	let best: { spec: IRangeSpec; size: number } | null = null;
	for (const decoration of decorations.find(pos, pos, isRangeSpec)) {
		if (pos < decoration.from || pos > decoration.to) continue;
		const size = decoration.to - decoration.from;
		if (!best || size < best.size) best = { spec: decoration.spec as IRangeSpec, size };
	}
	return best?.spec ?? null;
}

/** Where a thread's highlighted range is in the editor's document now, when its text is on the page. */
export function commentRangeBounds(state: EditorState, threadId: string): { from: number; to: number } | null {
	const decorations = blockCommentsStateOf(state)?.decorations;
	if (!decorations) return null;
	const found = decorations.find(undefined, undefined, (spec) => isRangeSpec(spec) && spec.threadId === threadId);
	return found.length ? { from: found[0].from, to: found[0].to } : null;
}

/** Builds the clickable gutter marker for one block (and, for a block lit by a range, its thread). */
function createMarker(blockId: string, options: IBlockCommentsOptions, threadId?: string): HTMLElement {
	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'gz-block-comment-marker';
	// The marker lives inside the contenteditable; without this ProseMirror would treat it
	// as text and let the caret walk into it.
	button.contentEditable = 'false';
	button.setAttribute('data-block-id', blockId);
	button.setAttribute('aria-label', options.markerLabel);
	button.textContent = '💬';
	// `mousedown` (not `click`) with the default prevented: a click inside the editor first
	// moves the selection, which would re-render the decoration out from under the handler.
	button.addEventListener('mousedown', (event: MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();
		if (threadId) options.onOpenThread(blockId, threadId);
		else options.onOpenThread(blockId);
	});
	return button;
}

/**
 * The decorations of the open blocks and of the ranges, and where each range is now.
 *
 * A block with an open thread without a range is tinted and gets a marker, exactly as before ranges existed. A range
 * is highlighted where it is found now, and its block gets a marker (not a tint) that opens the range's thread; a
 * range whose text is gone falls back to its block (a tint and a marker, as a thread without a range).
 */
function buildDecorations(
	doc: ProseMirrorNode,
	open: readonly string[],
	ranges: readonly ICommentRange[],
	activeThread: string | null,
	options: IBlockCommentsOptions
): { decorations: DecorationSet; places: ReadonlyMap<string, IDocumentCommentAnchorPosition> } {
	if (!open.length && !ranges.length) return { decorations: DecorationSet.empty, places: NO_PLACES };
	const decorations: Decoration[] = [];
	const openBlocks = new Set(open.map(String));
	const tinted = new Set(openBlocks);
	/** The blocks lit by a range: the thread their marker opens (the newest one there). */
	const rangeMarkers = new Map<string, IRangeSpec>();
	const places = new Map<string, IDocumentCommentAnchorPosition>();
	if (ranges.length) {
		const blocks = editorBlocksOf(doc);
		const byId = new Map(blocks.map((block) => [block.blockId, block]));
		const live = options.liveResolver?.() ?? null;
		// One work budget for the approximate matches of every range, each time the ranges are found again.
		const budget = { cells: DOCS_ANCHOR_FUZZY_BUDGET };
		for (const { threadId, blockId: threadBlockId, anchor } of ranges) {
			const found = resolveCommentAnchor(anchor, blocks, live, budget);
			places.set(threadId, found);
			const block = found.blockId ? byId.get(found.blockId) : undefined;
			if (!block) continue;
			const spec: IRangeSpec = { threadId, blockId: threadBlockId || block.blockId };
			if (found.start === null || found.end === null || found.end <= found.start) {
				// The text is gone: the thread is on its block again.
				tinted.add(block.blockId);
				rangeMarkers.set(block.blockId, spec);
				continue;
			}
			const from = positionOfTextOffset(block.node, block.pos, found.start, 'start');
			const to = positionOfTextOffset(block.node, block.pos, found.end, 'end');
			if (to <= from) continue;
			rangeMarkers.set(block.blockId, spec);
			const isActive = activeThread === threadId;
			decorations.push(
				Decoration.inline(
					from,
					to,
					{
						class: isActive ? 'gz-comment-range gz-comment-range--active' : 'gz-comment-range',
						'data-thread-id': threadId
					},
					spec
				)
			);
		}
	}
	doc.descendants((node: ProseMirrorNode, pos: number) => {
		const blockId = node.attrs?.[BLOCK_ID_ATTRIBUTE];
		if (typeof blockId !== 'string' || !blockId) return true;
		const isOpen = openBlocks.has(blockId);
		const range = rangeMarkers.get(blockId);
		if (!tinted.has(blockId) && !range) return true;
		if (tinted.has(blockId)) {
			decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: 'gz-block-commented' }));
		}
		// `side: -1` + a stable key: the widget renders at the block's own flow position and is only
		// rebuilt when the anchor set changes. A block with a thread without a range opens its block's
		// threads, as before; a block lit only by a range opens that range's thread.
		const threadId = isOpen ? undefined : range?.threadId;
		const markerBlockId = isOpen || !range ? blockId : range.blockId;
		decorations.push(
			Decoration.widget(pos, () => createMarker(markerBlockId, options, threadId), {
				side: -1,
				key: threadId
					? `gz-block-comment-${blockId}-${markerBlockId}-${threadId}`
					: `gz-block-comment-${blockId}`
			})
		);
		return true;
	});
	return { decorations: DecorationSet.create(doc, decorations), places };
}

export const BlockComments = Extension.create<IBlockCommentsOptions>({
	name: 'gzBlockComments',

	addOptions() {
		return {
			onOpenThread: () => void 0,
			markerLabel: 'Comments',
			onComment: undefined,
			liveResolver: undefined,
			onRangesResolved: undefined
		};
	},

	addKeyboardShortcuts() {
		return {
			// Comment on the selection, as the bubble menu's comment action.
			'Mod-Alt-m': () => {
				if (!this.options.onComment) return false;
				this.options.onComment();
				return true;
			}
		};
	},

	addProseMirrorPlugins() {
		const options = this.options;
		const build = (
			doc: ProseMirrorNode,
			open: readonly string[],
			ranges: readonly ICommentRange[],
			activeThread: string | null
		): IBlockCommentsState => ({
			open,
			ranges,
			activeThread,
			...buildDecorations(doc, open, ranges, activeThread, options),
			stale: false
		});
		return [
			new Plugin<IBlockCommentsState>({
				key: blockCommentsPluginKey,
				state: {
					init: () => ({
						open: [],
						ranges: [],
						activeThread: null,
						decorations: DecorationSet.empty,
						places: NO_PLACES,
						stale: false
					}),
					apply: (transaction, value, _previous, state) => {
						const open = transaction.getMeta(blockCommentsPluginKey) as string[] | undefined;
						const asked = transaction.getMeta(COMMENT_RANGES_META) as
							Partial<Pick<IBlockCommentsState, 'ranges' | 'activeThread'>> | undefined;
						if (Array.isArray(open) || asked || transaction.getMeta(REFRESH_RANGES_META)) {
							return build(
								state.doc,
								Array.isArray(open) ? open.map(String) : value.open,
								asked?.ranges ?? value.ranges,
								asked && 'activeThread' in asked ? (asked.activeThread ?? null) : value.activeThread
							);
						}
						if (!transaction.docChanged) return value;
						// Finding the ranges again reads the whole page: while it is typed in, the highlights move with
						// the text, and the ranges are found again a moment after the last edit.
						if (value.ranges.length) {
							return {
								...value,
								decorations: value.decorations.map(transaction.mapping, transaction.doc),
								stale: true
							};
						}
						return build(state.doc, value.open, value.ranges, value.activeThread);
					}
				},
				view: () => {
					let timer: ReturnType<typeof setTimeout> | null = null;
					return {
						update: (view, previous) => {
							const current = blockCommentsPluginKey.getState(view.state);
							const before = blockCommentsPluginKey.getState(previous);
							if (current && current.places !== before?.places)
								options.onRangesResolved?.(current.places);
							if (!current?.stale) return;
							// Only an edit moves the moment on; the caret moving meanwhile does not.
							if (timer && view.state.doc === previous.doc) return;
							if (timer) clearTimeout(timer);
							timer = setTimeout(() => {
								timer = null;
								if ((view as { isDestroyed?: boolean }).isDestroyed) return;
								view.dispatch(
									view.state.tr.setMeta(REFRESH_RANGES_META, true).setMeta('addToHistory', false)
								);
							}, COMMENT_RANGES_REFRESH_MS);
						},
						destroy: () => {
							if (timer) clearTimeout(timer);
						}
					};
				},
				props: {
					decorations(state) {
						return blockCommentsPluginKey.getState(state)?.decorations ?? DecorationSet.empty;
					},
					// A click in a highlighted range opens its thread; the caret still goes where the click was.
					handleClick(view, pos, event) {
						if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return false;
						const range = commentRangeAt(view.state, pos);
						if (range) options.onOpenThread(range.blockId, range.threadId);
						return false;
					}
				}
			})
		];
	}
});
