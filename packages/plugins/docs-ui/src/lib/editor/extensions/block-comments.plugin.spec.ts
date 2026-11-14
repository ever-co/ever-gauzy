import { Editor, Extension, type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { DocumentCommentAnchorMethodEnum, DocumentCommentAnchorStatusEnum } from '@gauzy/contracts';
import { anchorContextOf, type ICommentRange } from '../comments/comment-anchor.model';
import {
	BlockComments,
	COMMENT_RANGES_REFRESH_MS,
	blockCommentsStateOf,
	collectBlockIds,
	commentRangeBounds,
	enclosingBlockId,
	setActiveCommentThread,
	setCommentRanges,
	setCommentedBlocks
} from './block-comments.plugin';

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

const editorWith = (chain: IFakeNode[]): Editor => ({ state: { selection: selection(chain) } }) as unknown as Editor;

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
		}) as unknown as Editor;

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

/**
 * Comment ranges (`docs-collaboration` FR-16) on a real editor: the text an open thread was made on is highlighted
 * where it is found now, the highlight follows the text as it is edited, and the threads on blocks keep their tint and
 * marker exactly as before ranges.
 */
describe('comment ranges', () => {
	const TestBlockIds = Extension.create({
		name: 'testBlockIds',
		addGlobalAttributes() {
			return [{ types: ['paragraph'], attributes: { blockId: { default: null } } }];
		}
	});

	const FOX = 'The quick brown fox jumps over the lazy dog.';
	const paragraph = (blockId: string, text: string): JSONContent => ({
		type: 'paragraph',
		attrs: { blockId },
		content: text ? [{ type: 'text', text }] : []
	});

	/** A thread made on `quote` in `blockText`, as the rail hands it in (its anchor as the platform stores it). */
	const rangeOn = (threadId: string, blockText: string, quote: string, blockId = 'b1'): ICommentRange => {
		const start = blockText.indexOf(quote);
		const end = start + quote.length;
		return { threadId, blockId, anchor: { blockId, start, end, quote, ...anchorContextOf(blockText, start, end) } };
	};

	let editor: Editor;
	let onOpenThread: jest.Mock;
	let onRangesResolved: jest.Mock;

	function editorWith(...blocks: JSONContent[]): Editor {
		const element = document.createElement('div');
		document.body.append(element);
		onOpenThread = jest.fn();
		onRangesResolved = jest.fn();
		editor = new Editor({
			element,
			content: { type: 'doc', content: blocks },
			extensions: [
				StarterKit,
				TestBlockIds,
				BlockComments.configure({ onOpenThread, markerLabel: 'Open the comments', onRangesResolved })
			]
		});
		return editor;
	}

	const highlights = () =>
		Array.from(editor.view.dom.querySelectorAll<HTMLElement>('.gz-comment-range')).map((element) => ({
			text: element.textContent,
			thread: element.getAttribute('data-thread-id'),
			active: element.classList.contains('gz-comment-range--active')
		}));
	const tinted = () =>
		Array.from(editor.view.dom.querySelectorAll('.gz-block-commented')).map((element) =>
			element.getAttribute('blockId')
		);
	const markers = () =>
		Array.from(editor.view.dom.querySelectorAll<HTMLElement>('.gz-block-comment-marker')).map((element) =>
			element.getAttribute('data-block-id')
		);

	/** Types `text` at the start of the block that holds `anchorText`. */
	const typeBefore = (anchorText: string, inserted: string) => {
		let at = -1;
		editor.state.doc.descendants((node, pos) => {
			if (at < 0 && node.inlineContent && node.textContent.includes(anchorText)) at = pos + 1;
			return at < 0;
		});
		editor.view.dispatch(editor.state.tr.insertText(inserted, at));
	};

	beforeEach(() => jest.useFakeTimers());

	afterEach(() => {
		editor?.destroy();
		jest.useRealTimers();
		document.body.innerHTML = '';
	});

	it('highlights the text of a range thread, and marks its block without tinting it', () => {
		editorWith(paragraph('b1', FOX), paragraph('b2', 'Second block'));
		setCommentRanges(editor, [rangeOn('t1', FOX, 'brown fox')]);

		expect(highlights()).toEqual([{ text: 'brown fox', thread: 't1', active: false }]);
		expect(markers()).toEqual(['b1']);
		expect(tinted()).toEqual([]);
		// The page's text is unchanged: a decoration, never a mark.
		expect(editor.getJSON().content?.[0]).toEqual(paragraph('b1', FOX));
	});

	it('moves the highlight with the text while it is typed in, and finds it again a moment after', () => {
		editorWith(paragraph('b1', FOX));
		setCommentRanges(editor, [rangeOn('t1', FOX, 'brown fox')]);

		typeBefore('quick', 'Well, ');
		// Moved with the edit at once, before the ranges are found again.
		expect(highlights()).toEqual([{ text: 'brown fox', thread: 't1', active: false }]);
		expect(blockCommentsStateOf(editor.state)?.stale).toBe(true);

		jest.advanceTimersByTime(COMMENT_RANGES_REFRESH_MS);
		expect(blockCommentsStateOf(editor.state)?.stale).toBe(false);
		expect(highlights()).toEqual([{ text: 'brown fox', thread: 't1', active: false }]);
		expect(blockCommentsStateOf(editor.state)?.places.get('t1')).toMatchObject({
			status: DocumentCommentAnchorStatusEnum.MOVED,
			method: DocumentCommentAnchorMethodEnum.QUOTE,
			start: 16,
			end: 25,
			text: 'brown fox'
		});
	});

	it('finds the range again when the whole block was replaced (as a reload or a co-editor rewrites it)', () => {
		editorWith(paragraph('b1', FOX));
		setCommentRanges(editor, [rangeOn('t1', FOX, 'lazy dog')]);

		editor.commands.setContent({
			type: 'doc',
			content: [paragraph('b1', 'Now: over the lazy dog, the fox jumped.')]
		});
		jest.advanceTimersByTime(COMMENT_RANGES_REFRESH_MS);

		expect(highlights()).toEqual([{ text: 'lazy dog', thread: 't1', active: false }]);
	});

	it('falls back to the block once the text is gone: tinted and marked, as a thread without a range', () => {
		editorWith(paragraph('b1', FOX), paragraph('b2', 'Second block'));
		setCommentRanges(editor, [rangeOn('t1', FOX, 'brown fox')]);

		editor.commands.setContent({
			type: 'doc',
			content: [paragraph('b1', 'Rewritten'), paragraph('b2', 'Second block')]
		});
		jest.advanceTimersByTime(COMMENT_RANGES_REFRESH_MS);

		expect(highlights()).toEqual([]);
		expect(tinted()).toEqual(['b1']);
		expect(markers()).toEqual(['b1']);
		expect(blockCommentsStateOf(editor.state)?.places.get('t1')?.status).toBe(
			DocumentCommentAnchorStatusEnum.BLOCK
		);
	});

	it("opens a range's thread from its highlight and from its block's marker", () => {
		editorWith(paragraph('b1', FOX));
		setCommentRanges(editor, [rangeOn('t1', FOX, 'brown fox')]);
		const bounds = commentRangeBounds(editor.state, 't1');
		expect(bounds && editor.state.doc.textBetween(bounds.from, bounds.to)).toBe('brown fox');

		const click = new MouseEvent('click', { button: 0 });
		editor.view.someProp('handleClick', (handle) => handle(editor.view, bounds!.from + 2, click));
		expect(onOpenThread).toHaveBeenLastCalledWith('b1', 't1');

		editor.view.dom
			.querySelector('.gz-block-comment-marker')!
			.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
		expect(onOpenThread).toHaveBeenLastCalledWith('b1', 't1');

		onOpenThread.mockClear();
		editor.view.someProp('handleClick', (handle) => handle(editor.view, 2, click));
		expect(onOpenThread).not.toHaveBeenCalled();
	});

	it("opens a moved range's thread under the block the rail lists it on", () => {
		editorWith(paragraph('b1', 'The quick brown fox jumps.'), paragraph('b2', 'Over the lazy dog.'));
		setCommentRanges(editor, [rangeOn('t1', FOX, 'lazy dog')]);

		expect(highlights()).toEqual([{ text: 'lazy dog', thread: 't1', active: false }]);
		editor.view.dom
			.querySelector('.gz-block-comment-marker[data-block-id="b1"]')!
			.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
		expect(onOpenThread).toHaveBeenLastCalledWith('b1', 't1');
	});

	it('lights the thread asked for', () => {
		editorWith(paragraph('b1', FOX));
		setCommentRanges(editor, [rangeOn('t1', FOX, 'quick'), rangeOn('t2', FOX, 'lazy dog')]);
		setActiveCommentThread(editor, 't2');

		expect(highlights()).toEqual([
			{ text: 'quick', thread: 't1', active: false },
			{ text: 'lazy dog', thread: 't2', active: true }
		]);
	});

	it('keeps the threads on blocks as they were: tinted, with a marker that opens the block', () => {
		editorWith(paragraph('b1', FOX), paragraph('b2', 'Second block'));
		setCommentedBlocks(editor, ['b2']);
		setCommentRanges(editor, [rangeOn('t1', FOX, 'brown fox')]);

		expect(tinted()).toEqual(['b2']);
		expect(markers()).toEqual(['b1', 'b2']);
		editor.view.dom
			.querySelector('.gz-block-comment-marker[data-block-id="b2"]')!
			.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
		expect(onOpenThread).toHaveBeenLastCalledWith('b2');

		// Ranges cleared: only the block thread is left, as without ranges.
		setCommentRanges(editor, []);
		expect(highlights()).toEqual([]);
		expect(markers()).toEqual(['b2']);
	});

	it('tells where each range is each time the ranges are found again', () => {
		editorWith(paragraph('b1', FOX));
		setCommentRanges(editor, [rangeOn('t1', FOX, 'brown fox')]);
		expect(onRangesResolved).toHaveBeenCalledTimes(1);
		expect(onRangesResolved.mock.calls[0][0].get('t1')).toMatchObject({
			status: DocumentCommentAnchorStatusEnum.EXACT
		});

		typeBefore('quick', 'Hey. ');
		// Typing only moves the highlights: nothing is told until they are found again.
		expect(onRangesResolved).toHaveBeenCalledTimes(1);
		jest.advanceTimersByTime(COMMENT_RANGES_REFRESH_MS);
		expect(onRangesResolved).toHaveBeenCalledTimes(2);
		expect(onRangesResolved.mock.calls[1][0].get('t1')).toMatchObject({ start: 15, end: 24 });
	});

	it('reads the live relative positions first when the page is edited live', () => {
		const element = document.createElement('div');
		document.body.append(element);
		const liveResolver = jest.fn(
			() => (relative: string) =>
				relative === 'S' ? { blockId: 'b1', offset: 4 } : relative === 'E' ? { blockId: 'b1', offset: 9 } : null
		);
		editor = new Editor({
			element,
			content: { type: 'doc', content: [paragraph('b1', FOX)] },
			extensions: [
				StarterKit,
				TestBlockIds,
				BlockComments.configure({ onOpenThread: jest.fn(), markerLabel: '', liveResolver })
			]
		});
		const range = rangeOn('t1', FOX, 'brown fox');
		setCommentRanges(editor, [{ ...range, anchor: { ...range.anchor, relativeStart: 'S', relativeEnd: 'E' } }]);

		expect(highlights()).toEqual([{ text: 'quick', thread: 't1', active: false }]);
		expect(blockCommentsStateOf(editor.state)?.places.get('t1')?.method).toBe(
			DocumentCommentAnchorMethodEnum.RELATIVE
		);
	});
});
