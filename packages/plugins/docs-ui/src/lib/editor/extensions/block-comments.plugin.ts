import { Editor, Extension } from '@tiptap/core';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

/**
 * Block-comment markers (spec 05 §8).
 *
 * Comments are core `Comment` rows anchored to the UniqueID `blockId`; this extension is the
 * editor-side half: it decorates every block that has an **open** thread with a gutter marker
 * and a class, and the marker opens that thread in the page's Comments rail. It holds no
 * comment data of its own — the rail owns the fetch and pushes the anchor set in with
 * `setCommentedBlocks()`, so there is exactly one source of truth for "which blocks have
 * comments" and no second request.
 */

/** Carries the open-anchor set both as plugin state and as the transaction meta that sets it. */
export const blockCommentsPluginKey = new PluginKey<string[]>('gzBlockComments');

/** The attribute UniqueID is configured to write (`document-extensions.ts`). */
export const BLOCK_ID_ATTRIBUTE = 'blockId';

export interface IBlockCommentsOptions {
	/** Invoked when a gutter marker is activated. */
	onOpenThread: (blockId: string) => void;
	/** Accessible name for the marker button — resolved by the caller (this file has no i18n). */
	markerLabel: string;
}

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

/** Builds the clickable gutter marker for one block. */
function createMarker(blockId: string, options: IBlockCommentsOptions): HTMLElement {
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
		options.onOpenThread(blockId);
	});
	return button;
}

export const BlockComments = Extension.create<IBlockCommentsOptions>({
	name: 'gzBlockComments',

	addOptions() {
		return {
			onOpenThread: () => void 0,
			markerLabel: 'Comments'
		};
	},

	addProseMirrorPlugins() {
		const options = this.options;
		return [
			new Plugin<string[]>({
				key: blockCommentsPluginKey,
				state: {
					init: () => [],
					apply: (transaction, value) =>
						(transaction.getMeta(blockCommentsPluginKey) as string[] | undefined) ?? value
				},
				props: {
					decorations(state) {
						const open = blockCommentsPluginKey.getState(state) ?? [];
						if (!open.length) return DecorationSet.empty;
						const wanted = new Set(open.map(String));
						const decorations: Decoration[] = [];
						state.doc.descendants((node: ProseMirrorNode, pos: number) => {
							const blockId = node.attrs?.[BLOCK_ID_ATTRIBUTE];
							if (typeof blockId !== 'string' || !wanted.has(blockId)) return true;
							decorations.push(
								Decoration.node(pos, pos + node.nodeSize, { class: 'gz-block-commented' })
							);
							// `side: -1` + a stable key: the widget renders at the block's own
							// flow position and is only rebuilt when the anchor set changes.
							decorations.push(
								Decoration.widget(pos, () => createMarker(blockId, options), {
									side: -1,
									key: `gz-block-comment-${blockId}`
								})
							);
							return true;
						});
						return DecorationSet.create(state.doc, decorations);
					}
				}
			})
		];
	}
});
