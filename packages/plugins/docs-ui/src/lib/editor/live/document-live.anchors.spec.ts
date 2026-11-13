// cspell:ignore brastve
import { Editor, Extension, type JSONContent } from '@tiptap/core';
import Collaboration from '@tiptap/extension-collaboration';
import StarterKit from '@tiptap/starter-kit';
import * as Y from 'yjs';
import { DocumentCommentAnchorMethodEnum, DocumentCommentAnchorStatusEnum } from '@gauzy/contracts';
import { resolveCommentAnchor } from '../comments/comment-anchor.model';
import {
	editorBlockTextOf,
	editorBlocksOf,
	positionOfTextOffset,
	selectionCommentAnchor
} from '../extensions/comment-ranges';
import { LIVE_FIELD, liveAnchorResolverOf, liveRelativeRangeOf } from './document-live.anchors';

const TestBlockIds = Extension.create({
	name: 'testBlockIds',
	addGlobalAttributes() {
		return [{ types: ['paragraph'], attributes: { blockId: { default: null } } }];
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

/** The other copy of the page (another client, or the platform's live state), kept in step with the editor's. */
function syncInto(target: Y.Doc, source: Y.Doc): void {
	Y.applyUpdate(target, Y.encodeStateAsUpdate(source, Y.encodeStateVector(target)), 'remote');
}

/** The first `Y.XmlText` of the shared document's first paragraph. */
function firstText(doc: Y.Doc): Y.XmlText {
	const block = doc.getXmlFragment(LIVE_FIELD).get(0) as Y.XmlElement;
	return block.get(0) as Y.XmlText;
}

/** The editor positions of `quote` in the editor's document. */
function rangeOf(editor: Editor, quote: string): { from: number; to: number } {
	for (const block of editorBlocksOf(editor.state.doc)) {
		const at = editorBlockTextOf(block.node).indexOf(quote);
		if (at >= 0) {
			return {
				from: positionOfTextOffset(block.node, block.pos, at, 'start'),
				to: positionOfTextOffset(block.node, block.pos, at + quote.length, 'end')
			};
		}
	}
	throw new Error(`"${quote}" is not in the editor`);
}

/**
 * The live half of comment ranges: an editor bound to the page's shared document stores a range's ends as Yjs
 * relative positions, and they follow every concurrent edit, read alike in this editor and in any other copy of the
 * shared document (another client's, the platform's live state).
 */
describe('comment anchors in the shared document', () => {
	let doc: Y.Doc;
	let other: Y.Doc;
	let editor: Editor;

	beforeEach(() => {
		doc = new Y.Doc();
		other = new Y.Doc();
		editor = new Editor({
			element: document.createElement('div'),
			extensions: [
				StarterKit.configure({ undoRedo: false }),
				TestBlockIds,
				Collaboration.configure({ document: doc, field: LIVE_FIELD })
			]
		});
		editor.commands.setContent({
			type: 'doc',
			content: [
				paragraph('b1', text('Hello '), text('brave', [{ type: 'bold' }]), text(' new world')),
				paragraph('b2', text('Second block'))
			]
		});
		syncInto(other, doc);
	});

	afterEach(() => {
		editor.destroy();
		doc.destroy();
		other.destroy();
	});

	it("stores the selection's ends as relative positions that read back as its block and offsets", () => {
		editor.commands.setTextSelection(rangeOf(editor, 'brave'));
		const anchor = selectionCommentAnchor(editor.state, liveRelativeRangeOf(editor.state, doc));

		expect(anchor).toMatchObject({ blockId: 'b1', start: 6, end: 11, quote: 'brave' });
		expect(anchor?.relativeStart).toEqual(expect.any(String));
		expect(anchor?.relativeEnd).toEqual(expect.any(String));
		expect(liveAnchorResolverOf(doc)(anchor!.relativeStart!)).toEqual({ blockId: 'b1', offset: 6 });
		// Another copy of the page reads them alike.
		expect(liveAnchorResolverOf(other)(anchor!.relativeEnd!)).toEqual({ blockId: 'b1', offset: 11 });
	});

	it('keeps the range over concurrent edits, in this editor and in the other copy', () => {
		editor.commands.setTextSelection(rangeOf(editor, 'brave'));
		const anchor = selectionCommentAnchor(editor.state, liveRelativeRangeOf(editor.state, doc))!;

		// A co-editor types before the range, and inside it ("brave" -> "brastve").
		const runs = firstText(other);
		other.transact(() => {
			runs.insert(0, 'Oh, ');
			runs.insert(4 + 9, 'st');
		});
		syncInto(doc, other);
		expect(editor.getText()).toContain('Oh, Hello brastve new world');

		const here = resolveCommentAnchor(anchor, editorBlocksOf(editor.state.doc), liveAnchorResolverOf(doc));
		expect(here).toEqual({
			status: DocumentCommentAnchorStatusEnum.MOVED,
			method: DocumentCommentAnchorMethodEnum.RELATIVE,
			blockId: 'b1',
			start: 10,
			end: 17,
			text: 'brastve'
		});
		const there = resolveCommentAnchor(
			anchor,
			[{ blockId: 'b1', text: 'Oh, Hello brastve new world' }],
			liveAnchorResolverOf(other)
		);
		expect(there).toEqual(here);
	});

	it('reads a range another client made in its copy of the page', () => {
		// Made in the other copy: "Second" in b2, as `Y.createRelativePositionFromTypeIndex` there.
		const encode = (index: number) => {
			const block = other.getXmlFragment(LIVE_FIELD).get(1) as Y.XmlElement;
			const relative = Y.createRelativePositionFromTypeIndex(block.get(0) as Y.XmlText, index);
			return Buffer.from(Y.encodeRelativePosition(relative)).toString('base64');
		};
		const anchor = {
			blockId: 'b2',
			start: 0,
			end: 6,
			quote: 'Second',
			relativeStart: encode(0),
			relativeEnd: encode(6)
		};
		editor.commands.insertContentAt(rangeOf(editor, 'Second').from, 'The ');

		const found = resolveCommentAnchor(anchor, editorBlocksOf(editor.state.doc), liveAnchorResolverOf(doc));
		expect(found).toMatchObject({
			status: DocumentCommentAnchorStatusEnum.EXACT,
			method: DocumentCommentAnchorMethodEnum.RELATIVE,
			start: 4,
			end: 10,
			text: 'Second'
		});
	});

	it('reads nothing from a text merged away (a hard break removed between two runs), not the end of its block', () => {
		// Kept items (no garbage collection, as a copy that keeps history does): the merged-away text is still found.
		const page = new Y.Doc({ gc: false });
		const block = new Y.XmlElement('paragraph');
		block.setAttribute('blockId', 'b1');
		const first = new Y.XmlText('ab');
		const second = new Y.XmlText('cd tail');
		block.insert(0, [first, new Y.XmlElement('hardBreak'), second]);
		page.getXmlFragment(LIVE_FIELD).insert(0, [block]);
		const inSecond = Buffer.from(
			Y.encodeRelativePosition(Y.createRelativePositionFromTypeIndex(second, 1))
		).toString('base64');
		expect(liveAnchorResolverOf(page)(inSecond)).toEqual({ blockId: 'b1', offset: 3 });

		// The editor's sync merges the two runs once the break is gone: the second text leaves the block.
		page.transact(() => {
			block.delete(1, 2);
			first.insert(2, 'cd tail');
		});
		expect(liveAnchorResolverOf(page)(inSecond)).toBeNull();
		page.destroy();
	});

	it('reads nothing from a position the document does not hold, or from text that is no relative position', () => {
		const stranger = new Y.Doc();
		const element = new Y.XmlElement('paragraph');
		stranger.getXmlFragment(LIVE_FIELD).insert(0, [element]);
		const foreign = Buffer.from(
			Y.encodeRelativePosition(Y.createRelativePositionFromTypeIndex(element, 0))
		).toString('base64');
		const resolve = liveAnchorResolverOf(doc);
		expect(resolve(foreign)).toBeNull();
		expect(resolve('not base64 at all!')).toBeNull();
		expect(resolve('')).toBeNull();
		stranger.destroy();
	});

	it('gives no live ends for an editor that is not bound to the document', () => {
		const unbound = new Editor({
			element: document.createElement('div'),
			content: { type: 'doc', content: [paragraph('b1', text('Hello'))] },
			extensions: [StarterKit, TestBlockIds]
		});
		expect(liveRelativeRangeOf(unbound.state, doc)).toBeNull();
		expect(liveRelativeRangeOf(editor.state, other)).toBeNull();
		expect(liveRelativeRangeOf(editor.state, null)).toBeNull();
		unbound.destroy();
	});
});
