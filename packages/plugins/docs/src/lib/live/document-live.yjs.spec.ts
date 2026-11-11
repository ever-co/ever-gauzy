// cspell:ignore GZLV
import { getSchema } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {
	prosemirrorJSONToYDoc,
	prosemirrorJSONToYXmlFragment,
	yXmlFragmentToProsemirrorJSON,
	yXmlFragmentToProseMirrorRootNode
} from '@tiptap/y-tiptap';
import * as Y from 'yjs';
import {
	blockKey,
	decodeLiveState,
	encodeLiveState,
	LIVE_FRAGMENT,
	liveDocumentJson,
	normaliseNode,
	replaceLiveContent,
	seedLiveDocument
} from './document-live.yjs';

/** The editor's schema core, as far as the backend's tests can build it (the Angular extensions stay out). */
const schema = getSchema([StarterKit.configure({ undoRedo: false } as never)]);

const page = {
	type: 'doc',
	content: [
		{ type: 'heading', attrs: { level: 2, textAlign: null }, content: [{ type: 'text', text: 'Release plan' }] },
		{
			type: 'paragraph',
			content: [
				{ type: 'text', text: 'Ship ' },
				{ type: 'text', text: 'on Friday', marks: [{ type: 'bold' }] },
				{ type: 'text', text: ', see ' },
				{
					type: 'text',
					text: 'the board',
					marks: [
						{
							type: 'link',
							attrs: { href: 'https://example.test/board', target: '_blank', rel: null, class: null }
						}
					]
				},
				{ type: 'hardBreak' },
				{ type: 'text', text: 'thanks' }
			]
		},
		{
			type: 'bulletList',
			content: [
				{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one' }] }] },
				{
					type: 'listItem',
					content: [
						{ type: 'paragraph', content: [{ type: 'text', text: 'two', marks: [{ type: 'italic' }] }] }
					]
				}
			]
		},
		{ type: 'paragraph' }
	]
};

describe('document-live.yjs', () => {
	describe('the shared document reads as the editor binds it', () => {
		it('gives the editor binding the page it was seeded from', () => {
			const doc = seedLiveDocument('page-1', 3, page);
			const fragment = doc.getXmlFragment(LIVE_FRAGMENT);

			// What y-prosemirror (the editor's binding) builds from the server's state, checked against the schema.
			const root = yXmlFragmentToProseMirrorRootNode(fragment, schema);
			root.check();
			expect(normaliseNode(root.toJSON())).toEqual(normaliseNode(page as never));
			expect(normaliseNode(yXmlFragmentToProsemirrorJSON(fragment) as never)).toEqual(
				normaliseNode(page as never)
			);
		});

		it('reads back what the editor binding wrote', () => {
			const doc = new Y.Doc();
			prosemirrorJSONToYXmlFragment(schema, page, doc.getXmlFragment(LIVE_FRAGMENT));

			expect(liveDocumentJson(doc)).toEqual(normaliseNode(page as never));
		});

		it('round-trips its own JSON', () => {
			const doc = seedLiveDocument('page-1', 1, page);

			expect(liveDocumentJson(doc)).toEqual(normaliseNode(page as never));
			expect(liveDocumentJson(seedLiveDocument('page-1', 1, null))).toEqual({ type: 'doc', content: [] });
		});
	});

	describe('the seed', () => {
		it('is the same items in every process, so two seeds merge into one page', () => {
			const first = seedLiveDocument('page-1', 7, page);
			const second = seedLiveDocument('page-1', 7, page);

			expect(Buffer.from(Y.encodeStateAsUpdate(first)).equals(Buffer.from(Y.encodeStateAsUpdate(second)))).toBe(
				true
			);

			Y.applyUpdate(first, Y.encodeStateAsUpdate(second));
			expect(liveDocumentJson(first)).toEqual(normaliseNode(page as never));

			// Control: another revision is another lineage, and its items are not the same.
			const other = seedLiveDocument('page-1', 8, page);
			Y.applyUpdate(other, Y.encodeStateAsUpdate(first));
			expect(liveDocumentJson(other).content).toHaveLength(page.content.length * 2);
		});

		it('leaves the document writing under a client id of its own', () => {
			const first = seedLiveDocument('page-1', 7, page);
			const second = seedLiveDocument('page-1', 7, page);

			expect(first.clientID).not.toEqual(second.clientID);
		});
	});

	describe('the stored state', () => {
		it('carries the lineage and the revision it was persisted under, outside what an editor writes', () => {
			const doc = seedLiveDocument('page-1', 4, page);

			const decoded = decodeLiveState(encodeLiveState(doc, { lineage: 'page-1:4', revision: 5 }));

			expect(decoded?.meta).toEqual({ lineage: 'page-1:4', revision: 5 });
			expect(liveDocumentJson(decoded!.doc)).toEqual(normaliseNode(page as never));
			// The shared document holds the page and nothing else.
			expect([...doc.share.keys()]).toEqual([LIVE_FRAGMENT]);
		});

		it('is not the seed the editor has always sent with an autosave', () => {
			const editorSeed = Y.encodeStateAsUpdate(prosemirrorJSONToYDoc(schema, page));
			const badMeta = Buffer.concat([
				Buffer.from('GZLV1', 'ascii'),
				Buffer.from([0, 0, 0, 9]),
				Buffer.from('not json!')
			]);

			expect(decodeLiveState(Buffer.from(editorSeed))).toBeNull();
			expect(decodeLiveState(Buffer.from('not a yjs update'))).toBeNull();
			expect(decodeLiveState(badMeta)).toBeNull();
			expect(decodeLiveState(null)).toBeNull();
		});
	});

	describe('a server-side write', () => {
		it('replaces only the blocks that changed', () => {
			const doc = seedLiveDocument('page-1', 1, page);
			const next = {
				...page,
				content: [
					page.content[0],
					{ type: 'paragraph', content: [{ type: 'text', text: 'Moved to Monday' }] },
					...page.content.slice(2)
				]
			};

			const result = replaceLiveContent(doc, next);

			expect(result).toEqual({ kept: 3, written: 1 });
			expect(liveDocumentJson(doc)).toEqual(normaliseNode(next as never));
		});

		it('keeps what an editor typed meanwhile in a block the write did not change', () => {
			const server = seedLiveDocument('page-1', 1, page);
			const editor = new Y.Doc();
			Y.applyUpdate(editor, Y.encodeStateAsUpdate(server));

			// The editor types in the heading while the server replaces the second paragraph.
			const heading = editor.getXmlFragment(LIVE_FRAGMENT).get(0) as Y.XmlElement;
			(heading.get(0) as Y.XmlText).insert('Release plan'.length, ' v2');
			const typed = Y.encodeStateAsUpdate(editor, Y.encodeStateVector(server));

			const next = {
				...page,
				content: [
					page.content[0],
					{ type: 'paragraph', content: [{ type: 'text', text: 'Moved to Monday' }] },
					...page.content.slice(2)
				]
			};
			const before = Y.encodeStateVector(server);
			replaceLiveContent(server, next);
			const written = Y.encodeStateAsUpdate(server, before);

			Y.applyUpdate(server, typed);
			Y.applyUpdate(editor, written);

			const expected = normaliseNode({
				...next,
				content: [
					{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Release plan v2' }] },
					...next.content.slice(1)
				]
			} as never);
			expect(liveDocumentJson(server)).toEqual(expected);
			expect(liveDocumentJson(editor)).toEqual(expected);
		});

		it('writes the whole page when nothing is kept', () => {
			const doc = seedLiveDocument('page-1', 1, page);
			const next = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'fresh' }] }] };

			expect(replaceLiveContent(doc, next)).toEqual({ kept: 0, written: 1 });
			expect(liveDocumentJson(doc)).toEqual(next);
		});
	});

	describe('normalising', () => {
		it('compares blocks as the shared document gives them back', () => {
			expect(
				blockKey({
					type: 'paragraph',
					attrs: { textAlign: null },
					content: [
						{ type: 'text', text: 'a', marks: [{ type: 'bold', attrs: {} }] },
						{ type: 'text', text: 'b', marks: [{ type: 'bold' }] }
					]
				})
			).toEqual(
				blockKey({ type: 'paragraph', content: [{ type: 'text', text: 'ab', marks: [{ type: 'bold' }] }] })
			);
		});
	});
});
