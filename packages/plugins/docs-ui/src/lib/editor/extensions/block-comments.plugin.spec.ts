import { Editor } from '@tiptap/core';
import { collectBlockIds, enclosingBlockId, setCommentedBlocks } from './block-comments.plugin';

/**
 * Comment anchoring against the UniqueID `blockId` (spec 05 §8).
 *
 * A real TipTap editor (30+ extensions, a live DOM) buys nothing for these three: the
 * resolvers only walk `state.selection.$from` and `state.doc`, and `setCommentedBlocks`
 * only dispatches meta. The cases that actually broke in review are the ones covered:
 * a caret inside a list item (deepest node has no attrs) and a dispatch against a
 * destroyed editor after a `page/:id` rebuild.
 */

interface IFakeNode {
	attrs: Record<string, unknown>;
}

/** `$from`-style resolved position: `node(depth)` walks outwards from the selection head. */
const selection = (chain: IFakeNode[]) => ({
	$from: {
		depth: chain.length - 1,
		node: (depth: number) => chain[depth]
	}
});

const editorWith = (chain: IFakeNode[]): Editor => ({ state: { selection: selection(chain) } } as unknown as Editor);

const block = (blockId?: string): IFakeNode => ({ attrs: blockId ? { blockId } : {} });

describe('enclosingBlockId', () => {
	it('returns the block the caret sits in', () => {
		// doc (depth 0, never carries an id) → paragraph
		expect(enclosingBlockId(editorWith([block(), block('para-1')]))).toBe('para-1');
	});

	it('walks outwards when the deepest node has no id (list item, table cell)', () => {
		expect(enclosingBlockId(editorWith([block(), block('list-1'), block(), block()]))).toBe('list-1');
	});

	it('never anchors to the document node itself', () => {
		expect(enclosingBlockId(editorWith([block('doc'), block()]))).toBeNull();
	});

	it('returns null before UniqueID has stamped anything', () => {
		expect(enclosingBlockId(editorWith([block(), block()]))).toBeNull();
	});

	it('survives a missing or torn-down editor', () => {
		expect(enclosingBlockId(null)).toBeNull();
		expect(enclosingBlockId({} as Editor)).toBeNull();
	});
});

describe('collectBlockIds', () => {
	const docWith = (nodes: IFakeNode[]): Editor =>
		({
			state: {
				doc: {
					descendants: (visit: (node: IFakeNode) => boolean) => nodes.forEach((node) => visit(node))
				}
			}
		} as unknown as Editor);

	it('lists every stamped block in document order', () => {
		expect(collectBlockIds(docWith([block('a'), block(), block('b')]))).toEqual(['a', 'b']);
	});

	it('returns nothing for a missing editor', () => {
		expect(collectBlockIds(undefined)).toEqual([]);
	});
});

describe('setCommentedBlocks', () => {
	const liveEditor = () => {
		const transaction = { setMeta: jest.fn(() => transaction) };
		return {
			isDestroyed: false,
			view: { state: { tr: transaction }, dispatch: jest.fn() },
			transaction
		};
	};

	it('publishes the anchor set as transaction meta (never as a document change)', () => {
		const editor = liveEditor();

		setCommentedBlocks(editor as unknown as Editor, ['a', 'b']);

		expect(editor.transaction.setMeta).toHaveBeenCalledWith(expect.anything(), ['a', 'b']);
		expect(editor.view.dispatch).toHaveBeenCalledTimes(1);
	});

	it('does nothing against an editor the route rebuild already destroyed', () => {
		const editor = liveEditor();
		editor.isDestroyed = true;

		setCommentedBlocks(editor as unknown as Editor, ['a']);

		expect(editor.view.dispatch).not.toHaveBeenCalled();
	});
});
