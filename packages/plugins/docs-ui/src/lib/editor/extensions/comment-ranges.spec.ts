import { Editor, Extension, type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {
	blockAround,
	editorBlockTextOf,
	editorBlocksOf,
	positionOfTextOffset,
	selectionCommentAnchor,
	textOffsetInBlock
} from './comment-ranges';

/** The `blockId` attribute UniqueID writes in the real editor, with fixed ids. */
const TestBlockIds = Extension.create({
	name: 'testBlockIds',
	addGlobalAttributes() {
		return [
			{ types: ['paragraph', 'heading', 'bulletList', 'listItem'], attributes: { blockId: { default: null } } }
		];
	}
});

const paragraph = (blockId: string, ...content: JSONContent[]): JSONContent => ({
	type: 'paragraph',
	attrs: { blockId },
	content
});
const text = (value: string, marks?: JSONContent['marks']): JSONContent => ({
	type: 'text',
	text: value,
	...(marks ? { marks } : {})
});

function editorWith(...content: JSONContent[]): Editor {
	return new Editor({
		element: document.createElement('div'),
		content: { type: 'doc', content },
		extensions: [StarterKit, TestBlockIds]
	});
}

/** The editor positions of `quote` in the document (its first occurrence in one text node run). */
function rangeOf(editor: Editor, quote: string): { from: number; to: number } {
	let found: { from: number; to: number } | null = null;
	editor.state.doc.descendants((node, pos) => {
		if (found || !node.inlineContent) return !found;
		const blockText = editorBlockTextOf(node);
		const at = blockText.indexOf(quote);
		if (at < 0) return true;
		found = {
			from: positionOfTextOffset(node, pos, at, 'start'),
			to: positionOfTextOffset(node, pos, at + quote.length, 'end')
		};
		return false;
	});
	if (!found) throw new Error(`"${quote}" is not in the document`);
	return found;
}

describe('comment ranges in the editor document', () => {
	let editor: Editor;

	afterEach(() => editor?.destroy());

	it('lists the blocks with their text as the anchors count it (text nodes only)', () => {
		editor = editorWith(
			paragraph('b1', text('Hello '), { type: 'hardBreak' }, text('bold', [{ type: 'bold' }]), text(' world')),
			paragraph('b2', text('Second'))
		);
		expect(editorBlocksOf(editor.state.doc).map(({ blockId, text: blockText }) => [blockId, blockText])).toEqual([
			['b1', 'Hello bold world'],
			['b2', 'Second']
		]);
	});

	it('makes the selection an anchor: the block, offsets into its text, the quote and its context', () => {
		editor = editorWith(paragraph('b1', text('The quick brown fox jumps over the lazy dog.')));
		editor.commands.setTextSelection(rangeOf(editor, 'brown fox'));
		expect(selectionCommentAnchor(editor.state)).toEqual({
			blockId: 'b1',
			start: 10,
			end: 19,
			quote: 'brown fox',
			prefix: 'The quick ',
			suffix: ' jumps over the lazy dog.'
		});
	});

	it('counts the offsets over marks and inline atoms (a hard break adds nothing)', () => {
		editor = editorWith(
			paragraph('b1', text('Hello '), { type: 'hardBreak' }, text('bold', [{ type: 'bold' }]), text(' world'))
		);
		editor.commands.setTextSelection(rangeOf(editor, 'bold wor'));
		expect(selectionCommentAnchor(editor.state)).toMatchObject({
			blockId: 'b1',
			start: 6,
			end: 14,
			quote: 'bold wor'
		});
	});

	it('takes the innermost block with an id, and cuts a selection that runs on into the next block', () => {
		editor = editorWith(
			{
				type: 'bulletList',
				attrs: { blockId: 'list' },
				content: [{ type: 'listItem', content: [paragraph('item', text('First item'))] }]
			},
			paragraph('b2', text('After the list'))
		);
		const from = rangeOf(editor, 'item').from;
		const to = rangeOf(editor, 'After').to;
		editor.commands.setTextSelection({ from, to });
		expect(blockAround(editor.state, from)?.blockId).toBe('item');
		expect(selectionCommentAnchor(editor.state)).toMatchObject({
			blockId: 'item',
			start: 6,
			end: 10,
			quote: 'item'
		});
	});

	it('makes no anchor without selected text, or outside every block with an id', () => {
		editor = editorWith(paragraph('b1', text('Some text')), { type: 'paragraph', content: [text('No id here')] });
		editor.commands.setTextSelection(3);
		expect(selectionCommentAnchor(editor.state)).toBeNull();
		editor.commands.setTextSelection(rangeOf(editor, 'No id'));
		expect(selectionCommentAnchor(editor.state)).toBeNull();
	});

	it('maps text offsets to editor positions and back, never taking in an atom beside the range', () => {
		editor = editorWith(paragraph('b1', text('ab'), { type: 'hardBreak' }, text('cd')));
		const [block] = editorBlocksOf(editor.state.doc);
		// Offset 2 is both the end of "ab" and the start of "cd": a start goes after the break, an end before it.
		const start = positionOfTextOffset(block.node, block.pos, 2, 'start');
		const end = positionOfTextOffset(block.node, block.pos, 2, 'end');
		expect(start).toBe(end + 1);
		expect(textOffsetInBlock(block.node, block.pos, start)).toBe(2);
		expect(textOffsetInBlock(block.node, block.pos, end)).toBe(2);
		expect(editor.state.doc.textBetween(positionOfTextOffset(block.node, block.pos, 1, 'start'), end)).toBe('b');
	});

	it('keeps the live ends of the selection when the live binding reads them, and the offsets when it cannot', () => {
		editor = editorWith(paragraph('b1', text('The quick brown fox')));
		const range = rangeOf(editor, 'quick');
		editor.commands.setTextSelection(range);
		const live = jest.fn(() => ({ relativeStart: 'START', relativeEnd: 'END' }));
		expect(selectionCommentAnchor(editor.state, live)).toMatchObject({
			quote: 'quick',
			relativeStart: 'START',
			relativeEnd: 'END'
		});
		expect(live).toHaveBeenCalledWith(range.from, range.to);

		const failing = () => {
			throw new Error('not caught up');
		};
		const anchor = selectionCommentAnchor(editor.state, failing);
		expect(anchor).toMatchObject({ quote: 'quick', start: 4, end: 9 });
		expect(anchor).not.toHaveProperty('relativeStart');
	});
});
