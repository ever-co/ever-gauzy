import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { EditorState } from '@tiptap/pm/state';
import type { IDocumentCommentAnchorInput } from '@gauzy/contracts';
import { commentAnchorInputOf, type IAnchorBlock, type LiveRelativeRange } from '../comments/comment-anchor.model';

/**
 * Comment ranges in the editor's document: a block's text as the anchors count it (text nodes only), an editor
 * position as an offset into it and back, and the selection as an anchor. In a live session the ends are relative
 * positions of the shared document too, read through the live binding (`live/document-live.anchors.ts`), so Yjs stays
 * in the live chunk.
 */

/** The attribute UniqueID writes (`document-extensions.ts`). */
const BLOCK_ID = 'blockId';

/** A block of the editor's document: its anchor, its text, and where it is. */
export interface IEditorAnchorBlock extends IAnchorBlock {
	pos: number;
	node: ProseMirrorNode;
}

function blockIdOf(node: ProseMirrorNode): string | null {
	const value = node.attrs?.[BLOCK_ID];
	return typeof value === 'string' && value.length > 0 ? value : null;
}

/** The text of a node as the anchors count it: its text nodes, nothing between them. */
export function editorBlockTextOf(node: ProseMirrorNode): string {
	let text = '';
	node.descendants((child) => {
		if (child.isText) text += child.text ?? '';
		return true;
	});
	return text;
}

/** The blocks of the editor's document in order (an outer block before those inside it); a copied anchor is the first one's. */
export function editorBlocksOf(doc: ProseMirrorNode): IEditorAnchorBlock[] {
	const blocks: IEditorAnchorBlock[] = [];
	const seen = new Set<string>();
	doc.descendants((node, pos) => {
		const blockId = blockIdOf(node);
		if (blockId && !seen.has(blockId)) {
			seen.add(blockId);
			blocks.push({ blockId, text: editorBlockTextOf(node), pos, node });
		}
		return true;
	});
	return blocks;
}

/** The text nodes of the block at `blockPos`, in order: where each starts in the editor's document, and its length. */
function textRunsOf(node: ProseMirrorNode, blockPos: number): Array<{ from: number; size: number }> {
	const runs: Array<{ from: number; size: number }> = [];
	node.descendants((child, relative) => {
		if (!child.isText) return true;
		runs.push({ from: blockPos + 1 + relative, size: child.nodeSize });
		return false;
	});
	return runs;
}

/** The text before `pos` inside the block at `blockPos` (text nodes only). */
export function textOffsetInBlock(node: ProseMirrorNode, blockPos: number, pos: number): number {
	let offset = 0;
	for (const run of textRunsOf(node, blockPos)) {
		if (pos >= run.from + run.size) offset += run.size;
		else if (pos > run.from) offset += pos - run.from;
	}
	return offset;
}

/**
 * The editor position of a text offset in the block at `blockPos`. A range's start goes into the text after the offset
 * (`start`), its end into the text before it (`end`), so a range never takes in an atom beside it (a mention, a hard
 * break). An offset past the text is the end of the last text; a block without text answers its content's start.
 */
export function positionOfTextOffset(
	node: ProseMirrorNode,
	blockPos: number,
	offset: number,
	side: 'start' | 'end'
): number {
	const runs = textRunsOf(node, blockPos);
	let seen = 0;
	for (const run of runs) {
		const fits = side === 'start' ? offset < seen + run.size : offset <= seen + run.size;
		if (fits) return run.from + Math.max(0, offset - seen);
		seen += run.size;
	}
	const last = runs[runs.length - 1];
	return last ? last.from + last.size : blockPos + 1;
}

/** The innermost block with an anchor around a position, and where it is. */
export function blockAround(
	state: EditorState,
	pos: number
): { pos: number; node: ProseMirrorNode; blockId: string } | null {
	const $pos = state.doc.resolve(pos);
	for (let depth = $pos.depth; depth > 0; depth -= 1) {
		const node = $pos.node(depth);
		const blockId = blockIdOf(node);
		if (blockId) return { pos: $pos.before(depth), node, blockId };
	}
	return null;
}

/**
 * The selection as a comment's anchor: the innermost block with an anchor around its start, the range clamped to that
 * block, its offsets in the block's text and the quote. Null for no block or no text selected (the comment is then on
 * the block). In a live session the ends are kept as relative positions too.
 *
 * @param state The editor's state.
 * @param liveRange The live binding's reader of relative positions, while the page is edited live.
 */
export function selectionCommentAnchor(
	state: EditorState,
	liveRange?: LiveRelativeRange | null
): IDocumentCommentAnchorInput | null {
	const { from, to } = state.selection;
	if (to <= from) return null;
	const block = blockAround(state, from);
	if (!block) return null;
	const contentEnd = block.pos + block.node.nodeSize - 1;
	const end = Math.min(to, contentEnd);
	const startOffset = textOffsetInBlock(block.node, block.pos, from);
	const endOffset = textOffsetInBlock(block.node, block.pos, end);
	if (endOffset <= startOffset) return null;
	// The positions named are where the text starts and ends: what lies around it (an atom, the block's edge) is not.
	const relative = liveEndsOf(
		liveRange,
		positionOfTextOffset(block.node, block.pos, startOffset, 'start'),
		positionOfTextOffset(block.node, block.pos, endOffset, 'end')
	);
	return commentAnchorInputOf(block.blockId, editorBlockTextOf(block.node), startOffset, endOffset, relative);
}

/** The live ends of a range; none when the editor is not live or its binding is not caught up yet. */
function liveEndsOf(
	liveRange: LiveRelativeRange | null | undefined,
	from: number,
	to: number
): { relativeStart: string; relativeEnd: string } | null {
	try {
		return liveRange?.(from, to) ?? null;
	} catch {
		// The range is kept by its offsets and its quote.
		return null;
	}
}
