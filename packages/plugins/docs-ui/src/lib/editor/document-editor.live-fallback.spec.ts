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
/** The full extension set (node views, uploads, menus) buys nothing here: the paragraphs the live session edits do. */
jest.mock('./extensions/document-extensions', () => {
	const { default: StarterKit } = jest.requireActual('@tiptap/starter-kit');
	return {
		createDocumentEditorExtensions: ({ collab }: { collab: boolean }) => [
			collab ? StarterKit.configure({ undoRedo: false }) : StarterKit
		]
	};
});

import { HttpErrorResponse } from '@angular/common/http';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { Subject, of, throwError } from 'rxjs';
import * as Y from 'yjs';
import { IDocument } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { DocsLiveService } from '../services/docs-live.service';
import { DocumentsService } from '../services/documents.service';
import { DocumentEditorComponent } from './document-editor.component';
import type { IDocumentLiveFrame } from './live/document-live.binding';
import { DocumentAutosaveService } from './services/document-autosave.service';
import { EditorUploadService } from './services/editor-upload.service';
import { SuggestionHostService } from './suggestion/suggestion-host.service';

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');

/** The version the page was loaded at, when its live session began. */
const LIVE_START = '2026-11-01T10:00:00.000Z';
/** The version the page is read at once the session ended: the server saved the session's edits since. */
const AFTER_SESSION = '2026-11-01T10:05:00.000Z';

const LINEAGE = 'doc-1:1';

/** The server's live copy of the page: one paragraph. */
function serverSync(text: string, lineage = LINEAGE): IDocumentLiveFrame {
	const doc = new Y.Doc();
	const paragraph = new Y.XmlElement('paragraph');
	paragraph.insert(0, [new Y.XmlText(text)]);
	doc.getXmlFragment('default').insert(0, [paragraph]);
	return {
		kind: 'sync',
		documentId: 'doc-1',
		update: b64(Y.encodeStateAsUpdate(doc)),
		stateVector: b64(Y.encodeStateVector(doc)),
		awareness: null,
		readOnly: false,
		reason: null,
		revision: 1,
		lineage
	};
}

const paragraphJson = (text: string) => ({
	type: 'doc',
	content: [{ type: 'paragraph', content: [{ type: 'text', text }] }]
});

const page = (text: string, updatedAt: string): IDocument =>
	({
		id: 'doc-1',
		name: 'Page',
		updatedAt,
		contentJson: paragraphJson(text),
		contentHtml: `<p>${text}</p>`
	}) as unknown as IDocument;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(condition: () => boolean, label: string): Promise<void> {
	for (let attempt = 0; attempt < 200; attempt += 1) {
		if (condition()) return;
		await wait(10);
	}
	throw new Error(`timed out waiting for ${label}`);
}

/**
 * A live session that ends (`closed`, a stream that dies, a rebuilt page) used to rebuild the editor from the page
 * read afterwards, which drops what the session never took: the batch not sent yet, a send that failed. These run the
 * real binding and the real autosave behind the editor.
 */
describe('DocumentEditorComponent: a live session that ends keeps the edits it never took', () => {
	let fixture: ComponentFixture<DocumentEditorComponent>;
	let component: DocumentEditorComponent;
	let frames: Subject<IDocumentLiveFrame>;
	let postUpdate: jest.Mock;
	let getById: jest.Mock;
	let updateContent: jest.Mock;

	beforeEach(async () => {
		frames = new Subject<IDocumentLiveFrame>();
		postUpdate = jest.fn(() => Promise.resolve({}));
		getById = jest.fn(() => of(page('Server copy', AFTER_SESSION)));
		updateContent = jest.fn((_id: string, body: Record<string, unknown>) =>
			of({ ...page('saved', '2026-11-01T10:06:00.000Z'), contentJson: body['contentJson'] } as IDocument)
		);

		TestBed.configureTestingModule({
			imports: [DocumentEditorComponent],
			providers: [
				{
					provide: DocsLiveService,
					useValue: {
						available: () => Promise.resolve(true),
						frames: () => frames.asObservable(),
						postUpdate: (_documentId: string, _connectionId: string, update: string) =>
							postUpdate(_documentId, _connectionId, update),
						postAwareness: () => Promise.resolve({})
					}
				},
				{ provide: DocumentsService, useValue: { getById, updateContent } },
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
		component.document = page('Loaded copy', LIVE_START);
		fixture.detectChanges();
		await until(
			() =>
				!!component.editor &&
				component.hasUnsavedChanges === false &&
				!!(component as unknown as { liveBinding: unknown }).liveBinding,
			'the live editor'
		);
		frames.next(serverSync('Server text'));
		await until(() => component.isLive && component.editor?.getText() === 'Server text', 'the session sync');
		// The sync's own send (what the server lacks) settles before the test types.
		await wait(30);
		postUpdate.mockClear();
	});

	afterEach(() => {
		fixture.destroy();
		TestBed.resetTestingModule();
	});

	const type = (text: string) =>
		component.editor?.commands.insertContentAt(component.editor.state.doc.content.size - 1, text);

	const saved = (): Record<string, unknown>[] => updateContent.mock.calls.map(([, body]) => body);

	it('keeps a batch not sent yet, and saves it with autosave against the version the session began on', async () => {
		type(' and more');
		expect(component.hasUnsavedChanges).toBe(true);
		// The server shuts the session down inside the batch window: the edit never went.
		frames.next({ kind: 'closed', documentId: 'doc-1', reason: 'shutdown' });

		await until(() => updateContent.mock.calls.length > 0, 'the autosave save');
		expect(component.isLive).toBe(false);
		expect(component.editor?.getText()).toBe('Server text and more');
		expect(saved()[0]['contentHtml']).toBe('<p>Server text and more</p>');
		// A newer write (the session's own save of the server copy) meets the edits as a conflict, never overwritten.
		expect(saved()[0]['expectedUpdatedAt']).toBe(LIVE_START);
		expect(postUpdate).not.toHaveBeenCalled();
	});

	it('keeps edits whose send failed', async () => {
		postUpdate.mockImplementation(() => Promise.reject({ status: 0 }));
		type(' offline');
		await until(() => postUpdate.mock.calls.length > 0, 'the failed send');
		await wait(10);
		expect(component.hasUnsavedChanges).toBe(true);
		frames.error(new Error('socket closed'));

		await until(() => updateContent.mock.calls.length > 0, 'the autosave save');
		expect(component.editor?.getText()).toBe('Server text offline');
		expect(saved()[0]['contentHtml']).toBe('<p>Server text offline</p>');
		expect(saved()[0]['expectedUpdatedAt']).toBe(LIVE_START);
	});

	it('leaves the text on the page when the save meets a newer write, for the person to resolve', async () => {
		updateContent.mockImplementation(() =>
			throwError(
				() =>
					new HttpErrorResponse({
						status: 409,
						error: { code: 'DOCS_CONTENT_CONFLICT', currentUpdatedAt: AFTER_SESSION }
					})
			)
		);
		type(' mine');
		frames.next({ kind: 'closed', documentId: 'doc-1', reason: 'shutdown' });

		await until(() => component.autosave.state === 'conflict', 'the conflict');
		expect(component.editor?.getText()).toBe('Server text mine');
		expect(component.hasUnsavedChanges).toBe(true);
	});

	it('keeps them when the page cannot be read either, instead of the copy loaded before the session', async () => {
		getById.mockImplementation(() => throwError(() => new HttpErrorResponse({ status: 0 })));
		type(' unread');
		frames.next({ kind: 'closed', documentId: 'doc-1', reason: 'shutdown' });

		await until(() => updateContent.mock.calls.length > 0, 'the autosave save');
		expect(component.editor?.getText()).toBe('Server text unread');
		expect(saved()[0]['expectedUpdatedAt']).toBe(LIVE_START);
	});

	it('keeps edits the server refused (the page turned read-only), and leaves them to autosave', async () => {
		postUpdate.mockImplementation(() => Promise.reject({ status: 403 }));
		type(' refused');
		await until(() => postUpdate.mock.calls.length > 0 && component.liveState?.readOnly === true, 'the refusal');
		// Leaving now would drop the refused text: the page counts it as unsaved, and a flush cannot save it.
		expect(component.hasUnsavedChanges).toBe(true);
		await expect(component.flush()).resolves.toBe(false);
		frames.next({ kind: 'closed', documentId: 'doc-1', reason: 'locked' });

		await until(() => updateContent.mock.calls.length > 0, 'the autosave save');
		expect(component.editor?.getText()).toBe('Server text refused');
		expect(saved()[0]['expectedUpdatedAt']).toBe(LIVE_START);
	});

	it('saves unsent edits when the page cannot be read, even when they match the copy loaded before', async () => {
		getById.mockImplementation(() => throwError(() => new HttpErrorResponse({ status: 0 })));
		// The copy the editor holds as its input happens to read as the text the unsent edit makes; the server holds
		// the session's text before that edit.
		component.document = {
			...page('', LIVE_START),
			contentJson: paragraphJson('Server text again'),
			contentHtml: '<p>Server text again</p>'
		} as unknown as IDocument;
		type(' again');
		frames.next({ kind: 'closed', documentId: 'doc-1', reason: 'shutdown' });

		await until(() => updateContent.mock.calls.length > 0, 'the autosave save');
		expect(component.editor?.getText()).toBe('Server text again');
		expect(saved()[0]['expectedUpdatedAt']).toBe(LIVE_START);
	});

	it('shows the session text, unsaved, when the page cannot be read and nothing was left unsent', async () => {
		getById.mockImplementation(() => throwError(() => new HttpErrorResponse({ status: 0 })));
		// The page took a newer row meanwhile (a move): the editor never showed what it holds.
		component.document = page('Loaded copy', '2026-11-01T10:03:00.000Z');
		type(' sent');
		await until(() => postUpdate.mock.calls.length > 0 && component.hasUnsavedChanges === false, 'the send');
		frames.next({ kind: 'closed', documentId: 'doc-1', reason: 'shutdown' });

		await until(() => !component.isLive && component.liveState === null, 'the fallback');
		expect(component.editor?.getText()).toBe('Server text sent');
		expect(component.hasUnsavedChanges).toBe(false);
		expect(updateContent).not.toHaveBeenCalled();
		// The next edit is saved against the version the session began on, not the one loaded before.
		component.editor?.commands.insertContentAt(1, 'X');
		await component.flush();
		expect(saved()[0]['expectedUpdatedAt']).toBe(LIVE_START);
	});

	it('shows the page as read when every edit was taken', async () => {
		type(' sent');
		await until(() => postUpdate.mock.calls.length > 0 && component.hasUnsavedChanges === false, 'the send');
		frames.next({ kind: 'closed', documentId: 'doc-1', reason: 'shutdown' });

		await until(() => component.editor?.getText() === 'Server copy', 'the page read again');
		expect(updateContent).not.toHaveBeenCalled();
		expect(component.hasUnsavedChanges).toBe(false);
	});

	it('saves nothing when the page read again already holds the unsent text', async () => {
		type(' landed');
		const shown = component.getJSON();
		getById.mockImplementation(() =>
			of({
				...page('', AFTER_SESSION),
				contentJson: shown,
				contentHtml: '<p>Server text landed</p>'
			} as IDocument)
		);
		frames.next({ kind: 'closed', documentId: 'doc-1', reason: 'shutdown' });

		await until(() => !component.isLive && component.liveState === null, 'the fallback');
		await wait(20);
		expect(component.editor?.getText()).toBe('Server text landed');
		expect(updateContent).not.toHaveBeenCalled();
		expect(component.hasUnsavedChanges).toBe(false);
	});

	it('does not rejoin a rebuilt page with an empty document while edits are unsent: it keeps them with autosave', async () => {
		postUpdate.mockImplementation(() => Promise.reject({ status: 0 }));
		type(' before rebuild');
		await until(() => postUpdate.mock.calls.length > 0, 'the failed send');
		// The session comes back on a page rebuilt on the server.
		frames.next(serverSync('Rebuilt', 'doc-1:2'));

		await until(() => updateContent.mock.calls.length > 0, 'the autosave save');
		expect(component.isLive).toBe(false);
		expect(component.editor?.getText()).toBe('Server text before rebuild');
		expect(saved()[0]['expectedUpdatedAt']).toBe(LIVE_START);
	});
});
