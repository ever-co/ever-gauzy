/**
 * `@gauzy/ui-core/core` is a barrel over the whole app core: importing it pulls Akita's untranspiled ESM into the
 * CommonJS test runtime. The editor only uses these classes as DI tokens.
 */
jest.mock('@gauzy/ui-core/core', () => ({
	Store: class Store {},
	ToastrService: class ToastrService {},
	EmployeesService: class EmployeesService {}
}));
jest.mock('../services/docs-live.service', () => ({ DocsLiveService: class DocsLiveService {} }));
jest.mock('../services/documents.service', () => ({ DocumentsService: class DocumentsService {} }));
jest.mock('./suggestion/suggestion-host.service', () => ({ SuggestionHostService: class SuggestionHostService {} }));
/**
 * The full extension set (node views, uploads, menus) buys nothing here: paragraphs with a `blockId`, and the comment
 * layer wired to the editor's callbacks as `createDocumentEditorExtensions` wires it (the real factory's wiring has its
 * own contract test, `document-extensions.comments.spec.ts`), and collapsible toggles.
 */
jest.mock('./extensions/document-extensions', () => {
	const { default: StarterKit } = jest.requireActual('@tiptap/starter-kit');
	const { Extension } = jest.requireActual('@tiptap/core');
	const { BlockComments } = jest.requireActual('./extensions/block-comments.plugin');
	const { Details, DetailsContent, DetailsSummary } = jest.requireActual('@tiptap/extension-details');
	const BlockIds = Extension.create({
		name: 'testBlockIds',
		addGlobalAttributes: () => [{ types: ['paragraph'], attributes: { blockId: { default: null } } }]
	});
	return {
		createDocumentEditorExtensions: (
			deps: Record<string, (...args: unknown[]) => unknown> & { collab: boolean }
		) => [
			deps.collab ? StarterKit.configure({ undoRedo: false }) : StarterKit,
			BlockIds,
			Details.configure({ persist: true }),
			DetailsSummary,
			DetailsContent,
			BlockComments.configure({
				onOpenThread: (blockId: string, threadId?: string) => deps['onOpenCommentThread']?.(blockId, threadId),
				markerLabel: 'Open the comments',
				onComment: () => deps['onCommentSelection']?.(),
				liveResolver: () => deps['commentLiveResolver']?.() ?? null,
				onRangesResolved: (places: unknown) => deps['onCommentRangesResolved']?.(places)
			})
		]
	};
});

import { LiveAnnouncer } from '@angular/cdk/a11y';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { Subject, of } from 'rxjs';
import * as Y from 'yjs';
import { DocumentCommentAnchorMethodEnum, type IDocument, type IDocumentCommentAnchorPosition } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { DocsLiveService } from '../services/docs-live.service';
import { DocumentsService } from '../services/documents.service';
import { resolveCommentAnchor } from './comments/comment-anchor.model';
import { DocumentEditorComponent, type IDocsCommentRequest } from './document-editor.component';
import { editorBlockTextOf, editorBlocksOf, positionOfTextOffset } from './extensions/comment-ranges';
import type { IDocumentLiveFrame } from './live/document-live.binding';
import { liveAnchorResolverOf } from './live/document-live.anchors';
import { DocumentAutosaveService } from './services/document-autosave.service';
import { EditorUploadService } from './services/editor-upload.service';
import { SuggestionHostService } from './suggestion/suggestion-host.service';

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');
const FOX = 'The quick brown fox jumps over the lazy dog.';
const LINEAGE = 'doc-1:1';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(condition: () => boolean, label: string): Promise<void> {
	for (let attempt = 0; attempt < 200; attempt += 1) {
		if (condition()) return;
		await wait(10);
	}
	throw new Error(`timed out waiting for ${label}`);
}

/** The platform's live copy of the page: one paragraph `b1`. */
function serverPage(text: string) {
	const doc = new Y.Doc();
	const paragraph = new Y.XmlElement('paragraph');
	paragraph.setAttribute('blockId', 'b1');
	paragraph.insert(0, [new Y.XmlText(text)]);
	doc.getXmlFragment('default').insert(0, [paragraph]);
	return {
		doc,
		runs: () => paragraph.get(0) as Y.XmlText,
		sync: (): IDocumentLiveFrame => ({
			kind: 'sync',
			documentId: 'doc-1',
			update: b64(Y.encodeStateAsUpdate(doc)),
			stateVector: b64(Y.encodeStateVector(doc)),
			awareness: null,
			readOnly: false,
			reason: null,
			revision: 1,
			lineage: LINEAGE
		}),
		/** A co-editor's edit, as the platform relays it. */
		edit: (change: () => void): IDocumentLiveFrame => {
			const before = Y.encodeStateVector(doc);
			doc.transact(change);
			return { kind: 'update', documentId: 'doc-1', update: b64(Y.encodeStateAsUpdate(doc, before)) };
		}
	};
}

const page = (text: string): IDocument =>
	({
		id: 'doc-1',
		name: 'Page',
		updatedAt: '2026-11-01T10:00:00.000Z',
		contentJson: {
			type: 'doc',
			content: [{ type: 'paragraph', attrs: { blockId: 'b1' }, content: [{ type: 'text', text }] }]
		},
		contentHtml: `<p>${text}</p>`
	}) as unknown as IDocument;

/**
 * Range comments through the editor component, as the page drives it: the selection becomes a thread's range (with
 * live relative positions in a live session), the range is highlighted, and it follows the text as co-editors and the
 * person edit the page.
 */
describe('DocumentEditorComponent: comment ranges', () => {
	let fixture: ComponentFixture<DocumentEditorComponent>;
	let component: DocumentEditorComponent;
	let frames: Subject<IDocumentLiveFrame>;
	let requests: IDocsCommentRequest[];
	let places: Array<ReadonlyMap<string, IDocumentCommentAnchorPosition>>;

	async function open(live: boolean, document: IDocument, beforeBuild?: () => void): Promise<void> {
		frames = new Subject<IDocumentLiveFrame>();
		TestBed.configureTestingModule({
			imports: [DocumentEditorComponent],
			providers: [
				{
					provide: DocsLiveService,
					useValue: {
						available: () => Promise.resolve(live),
						frames: () => frames.asObservable(),
						postUpdate: () => Promise.resolve({}),
						postAwareness: () => Promise.resolve({})
					}
				},
				{
					provide: DocumentsService,
					useValue: { getById: () => of(document), updateContent: () => of(document) }
				},
				{ provide: Store, useValue: { user: { id: 'user-1', firstName: 'Ada' } } },
				{ provide: TranslateService, useValue: { instant: (key: string) => key } },
				{ provide: NbDialogService, useValue: { open: jest.fn() } },
				{ provide: LiveAnnouncer, useValue: { announce: () => Promise.resolve() } }
			]
		});
		TestBed.overrideComponent(DocumentEditorComponent, {
			set: {
				imports: [],
				template: '<div #editorHost></div><input #fileInput type="file" />',
				styleUrls: [],
				providers: [
					DocumentAutosaveService,
					{
						provide: EditorUploadService,
						useValue: { parentDocumentId: null, hasPending: false, destroy: () => undefined }
					},
					{ provide: SuggestionHostService, useValue: { close: () => undefined } }
				]
			}
		});
		await TestBed.compileComponents();
		fixture = TestBed.createComponent(DocumentEditorComponent);
		component = fixture.componentInstance;
		requests = [];
		places = [];
		component.commentRequested.subscribe((request) => requests.push(request));
		component.commentRangesResolved.subscribe((resolved) => places.push(resolved));
		component.document = document;
		beforeBuild?.();
		fixture.detectChanges();
		await until(() => !!component.editor, 'the editor');
	}

	afterEach(() => {
		fixture?.destroy();
		TestBed.resetTestingModule();
	});

	const highlights = () =>
		Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.gz-comment-range')).map(
			(element) => element.textContent
		);

	/** Selects `quote` in the editor. */
	const select = (quote: string) => {
		const editor = component.editor!;
		for (const block of editorBlocksOf(editor.state.doc)) {
			const at = editorBlockTextOf(block.node).indexOf(quote);
			if (at < 0) continue;
			editor.commands.setTextSelection({
				from: positionOfTextOffset(block.node, block.pos, at, 'start'),
				to: positionOfTextOffset(block.node, block.pos, at + quote.length, 'end')
			});
			return;
		}
		throw new Error(`"${quote}" is not in the editor`);
	};

	it('makes a live thread’s range with relative positions that follow a co-editor’s edits', async () => {
		const server = serverPage(FOX);
		await open(true, page(FOX));
		await until(() => !!(component as unknown as { liveBinding: unknown }).liveBinding, 'the live binding');
		frames.next(server.sync());
		await until(() => component.isLive && component.editor?.getText() === FOX, 'the session sync');

		select('brown fox');
		component.requestComment('b1');
		const range = requests[0].range!;
		expect(requests[0].blockId).toBe('b1');
		expect(range).toMatchObject({ blockId: 'b1', start: 10, end: 19, quote: 'brown fox' });
		expect(range.relativeStart).toEqual(expect.any(String));
		expect(range.relativeEnd).toEqual(expect.any(String));

		component.setCommentRanges([{ threadId: 't1', blockId: 'b1', anchor: range }]);
		expect(highlights()).toEqual(['brown fox']);

		// A co-editor types before the range and inside it.
		frames.next(
			server.edit(() => {
				server.runs().insert(0, 'Well, ');
				server.runs().insert(6 + 15, 'ish'); // "brown fox" -> "brownish fox"
			})
		);
		await until(() => component.editor?.getText().startsWith('Well, ') === true, 'the co-editor edit');
		await until(() => highlights()[0] === 'brownish fox', 'the range found again');
		await until(() => places.length > 0 && places[places.length - 1].get('t1')?.start === 16, 'the places');
		expect(places[places.length - 1].get('t1')).toMatchObject({
			method: DocumentCommentAnchorMethodEnum.RELATIVE,
			text: 'brownish fox'
		});

		// The platform reads the same range in its live copy of the page.
		const platform = resolveCommentAnchor(
			range,
			[{ blockId: 'b1', text: server.runs().toString() as string }],
			liveAnchorResolverOf(server.doc)
		);
		expect(platform).toEqual(places[places.length - 1].get('t1'));
	});

	it('draws the ranges again on the editor rebuilt when the live session ends', async () => {
		const server = serverPage(FOX);
		await open(true, page(FOX));
		await until(() => !!(component as unknown as { liveBinding: unknown }).liveBinding, 'the live binding');
		frames.next(server.sync());
		await until(() => component.isLive && component.editor?.getText() === FOX, 'the session sync');
		component.setCommentedBlocks([]);
		component.setCommentRanges([
			{ threadId: 't1', blockId: 'b1', anchor: { blockId: 'b1', start: 35, end: 43, quote: 'lazy dog' } }
		]);
		const before = component.editor;

		frames.next({ kind: 'closed', documentId: 'doc-1', reason: 'shutdown' });
		await until(
			() => !!component.editor && component.editor !== before && !component.isLive,
			'the autosave editor'
		);

		await until(() => highlights()[0] === 'lazy dog', 'the range drawn again');
	});

	it('comments on the selection with Mod-Alt-M, and on the block without one, while saving on its own', async () => {
		await open(false, page(FOX));
		await until(() => component.editor?.getText() === FOX, 'the page');

		select('quick');
		component.editor!.commands.keyboardShortcut('Mod-Alt-m');
		expect(requests[0]).toEqual({
			blockId: 'b1',
			range: {
				blockId: 'b1',
				start: 4,
				end: 9,
				quote: 'quick',
				prefix: 'The ',
				suffix: ' brown fox jumps over the lazy d'
			}
		});

		component.editor!.commands.setTextSelection(3);
		component.requestComment('b1');
		expect(requests[1]).toEqual({ blockId: 'b1', range: null });
	});

	it('scrolls to a thread asked for before its range was handed in (a resolved one)', async () => {
		await open(false, page(FOX));
		await until(() => component.editor?.getText() === FOX, 'the page');
		const scrolled = jest.fn();
		Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { value: scrolled, configurable: true });
		try {
			expect(component.focusCommentRange('t9')).toBe(false);
			component.setCommentRanges([
				{ threadId: 't9', blockId: 'b1', anchor: { blockId: 'b1', start: 35, end: 43, quote: 'lazy dog' } }
			]);
			expect(scrolled).toHaveBeenCalledTimes(1);
			expect((fixture.nativeElement as HTMLElement).querySelector('.gz-comment-range--active')?.textContent).toBe(
				'lazy dog'
			);

			// Another thread asked for meanwhile: the first one is not scrolled to any more.
			expect(component.focusCommentRange('t10')).toBe(false);
			component.setActiveCommentThread('t1');
			component.setCommentRanges([
				{ threadId: 't10', blockId: 'b1', anchor: { blockId: 'b1', start: 4, end: 9, quote: 'quick' } }
			]);
			expect(scrolled).toHaveBeenCalledTimes(1);
		} finally {
			delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
		}
	});

	it('moves a saved page’s range with the text typed before it, and lights the thread asked for', async () => {
		await open(false, page(FOX));
		await until(() => component.editor?.getText() === FOX, 'the page');
		component.setCommentRanges([
			{ threadId: 't1', blockId: 'b1', anchor: { blockId: 'b1', start: 10, end: 19, quote: 'brown fox' } }
		]);

		component.editor!.commands.insertContentAt(1, 'Today ');
		expect(highlights()).toEqual(['brown fox']);
		await until(() => places.some((resolved) => resolved.get('t1')?.start === 16), 'the range found again');

		expect(component.focusCommentRange('t1')).toBe(true);
		expect((fixture.nativeElement as HTMLElement).querySelector('.gz-comment-range--active')?.textContent).toBe(
			'brown fox'
		);
		expect(component.focusCommentRange('missing')).toBe(false);
	});

	/** Records `scrollIntoView` calls (jsdom has none) for the length of `run`. */
	async function withScroll(run: (scrolled: jest.Mock) => Promise<void>): Promise<void> {
		const scrolled = jest.fn();
		Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { value: scrolled, configurable: true });
		try {
			await run(scrolled);
		} finally {
			delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
		}
	}

	const LAZY_DOG = {
		threadId: 't1',
		blockId: 'b1',
		anchor: { blockId: 'b1', start: 35, end: 43, quote: 'lazy dog' }
	};

	it('keeps a thread asked for before the editor was built, and scrolls to it once its text is drawn', () =>
		withScroll(async (scrolled) => {
			await open(false, page(FOX), () => {
				component.setCommentRanges([LAZY_DOG]);
				expect(component.focusCommentRange('t1')).toBe(false);
			});
			await until(() => scrolled.mock.calls.length > 0, 'the scroll');
			expect((fixture.nativeElement as HTMLElement).querySelector('.gz-comment-range--active')?.textContent).toBe(
				'lazy dog'
			);
		}));

	it('scrolls to a thread asked for before the live page synced, once its text arrives', () =>
		withScroll(async (scrolled) => {
			const server = serverPage(FOX);
			await open(true, page(FOX));
			await until(() => !!(component as unknown as { liveBinding: unknown }).liveBinding, 'the live binding');
			component.setCommentRanges([LAZY_DOG]);
			expect(component.focusCommentRange('t1')).toBe(false);

			frames.next(server.sync());
			await until(() => scrolled.mock.calls.length > 0, 'the scroll after the sync');
			expect(highlights()).toEqual(['lazy dog']);
		}));

	it('opens the collapsed toggle a range is in before scrolling to it', () =>
		withScroll(async (scrolled) => {
			const inToggle = {
				...page(FOX),
				contentJson: {
					type: 'doc',
					content: [
						{
							type: 'details',
							attrs: { open: false },
							content: [
								{ type: 'detailsSummary', content: [{ type: 'text', text: 'More' }] },
								{
									type: 'detailsContent',
									content: [
										{
											type: 'paragraph',
											attrs: { blockId: 'b2' },
											content: [{ type: 'text', text: 'Hidden text' }]
										}
									]
								}
							]
						}
					]
				}
			} as unknown as IDocument;
			await open(false, inToggle);
			await until(() => component.editor?.getText().includes('Hidden text') === true, 'the page');
			const toggle = () => (fixture.nativeElement as HTMLElement).querySelector('[data-type="details"]');
			expect(toggle()?.classList.contains('is-open')).toBe(false);
			component.setCommentRanges([
				{ threadId: 't2', blockId: 'b2', anchor: { blockId: 'b2', start: 0, end: 6, quote: 'Hidden' } }
			]);

			expect(component.focusCommentRange('t2')).toBe(true);
			expect(toggle()?.classList.contains('is-open')).toBe(true);
			expect(scrolled).toHaveBeenCalledTimes(1);
		}));
});
