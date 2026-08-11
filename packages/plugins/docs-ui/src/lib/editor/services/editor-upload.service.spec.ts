/**
 * `@gauzy/ui-core/core` is a barrel over the whole app core — importing it (via
 * `DocumentsService` and `ToastrService`, which are only ever DI tokens here) pulls
 * Akita's untranspiled ESM into the CommonJS test runtime.
 */
jest.mock('@gauzy/ui-core/core', () => ({
	Store: class Store {},
	ToastrService: class ToastrService {}
}));

import { HttpEventType } from '@angular/common/http';
import { Injector, NgZone } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { Editor } from '@tiptap/core';
import { IDocument } from '@gauzy/contracts';
import { ToastrService } from '@gauzy/ui-core/core';
import { DocumentsService } from '../../services/documents.service';
import { EditorUploadService } from './editor-upload.service';

/**
 * Editor upload teardown (spec 05 §6.6).
 *
 * `destroy()` revoked the object URLs but left the HTTP subscriptions open, so a response
 * that landed after the editor was torn down — the component being destroyed, or a
 * `page/:id` rebuild — ran `swap()`/`fail()` against a dead ProseMirror view, and could
 * write a child FILE document into a page it no longer belonged to.
 */
describe('EditorUploadService — in-flight teardown', () => {
	/** Placeholder nodes the fake editor "inserted", in document order. */
	interface IFakeNode {
		attrs: Record<string, unknown>;
		nodeSize: number;
	}

	const makeEditor = () => {
		const nodes: IFakeNode[] = [];
		const tr = {
			setNodeMarkup: jest.fn(() => tr),
			setMeta: jest.fn(() => tr),
			delete: jest.fn(() => tr)
		};
		const state = {
			tr,
			doc: {
				descendants: (visit: (node: IFakeNode, pos: number) => boolean | void) => {
					nodes.forEach((node, index) => visit(node, index));
				}
			}
		};
		const chain = {
			focus: () => chain,
			insertContent: (content: { attrs: Record<string, unknown> }) => {
				nodes.push({ attrs: content.attrs, nodeSize: 1 });
				return chain;
			},
			insertContentAt: (_pos: number, content: { attrs: Record<string, unknown> }) => {
				nodes.push({ attrs: content.attrs, nodeSize: 1 });
				return chain;
			},
			run: () => true
		};
		return {
			nodes,
			tr,
			chain: () => chain,
			state,
			view: { state, dispatch: jest.fn() }
		};
	};

	type FakeEditor = ReturnType<typeof makeEditor>;

	const asEditor = (editor: FakeEditor): Editor => editor as unknown as Editor;

	/** The service only uses the zone to hop back in — run straight through. */
	const zone = {
		run: <T>(fn: () => T): T => fn(),
		runOutsideAngular: <T>(fn: () => T): T => fn()
	} as unknown as NgZone;

	const uploaded = (id: string): IDocument => ({ id, name: 'notes.pdf' }) as unknown as IDocument;

	const responseEvent = (document: IDocument) =>
		({ type: HttpEventType.Response, body: document }) as never;

	let response$: Subject<unknown>;
	let upload: jest.Mock;
	let rawUrl: jest.Mock;
	let service: EditorUploadService;
	let editor: FakeEditor;

	const file = (): File => new File(['pdf-bytes'], 'notes.pdf', { type: 'application/pdf' });

	beforeEach(() => {
		response$ = new Subject<unknown>();
		upload = jest.fn(() => response$.asObservable());
		rawUrl = jest.fn((id: string) => `/api/documents/${id}/raw`);
		editor = makeEditor();

		const injector = Injector.create({
			providers: [
				{ provide: DocumentsService, useValue: { upload, rawUrl } },
				{ provide: ToastrService, useValue: { danger: jest.fn() } },
				{ provide: TranslateService, useValue: { instant: (key: string) => key } },
				{ provide: NgZone, useValue: zone },
				{ provide: EditorUploadService, useClass: EditorUploadService, deps: [] }
			]
		});
		service = injector.get(EditorUploadService);
		service.parentDocumentId = 'doc-1';
	});

	it('swaps the placeholder for the uploaded document while the editor is alive (unchanged behaviour)', () => {
		service.handleFiles(asEditor(editor), [file()]);
		expect(upload).toHaveBeenCalledTimes(1);
		expect(service.hasPending).toBe(true);

		response$.next(responseEvent(uploaded('file-9')));
		response$.complete();

		expect(editor.tr.setNodeMarkup).toHaveBeenCalledTimes(1);
		expect(editor.view.dispatch).toHaveBeenCalledTimes(1);
		expect(editor.tr.setNodeMarkup.mock.calls[0][2]).toEqual(
			expect.objectContaining({ documentId: 'file-9', uploadId: null })
		);
		expect(service.hasPending).toBe(false);
	});

	it('cancels the in-flight request on `destroy()`', () => {
		service.handleFiles(asEditor(editor), [file()]);
		expect(response$.observed).toBe(true);

		service.destroy();

		// The request is gone — nothing is still being paid for, and nothing can answer.
		expect(response$.observed).toBe(false);
		expect(service.hasPending).toBe(false);
	});

	it('never dispatches into the editor for a response that arrives after `destroy()`', () => {
		service.handleFiles(asEditor(editor), [file()]);
		service.destroy();

		// Even a subscriber that somehow survived cancellation must find the door shut:
		// `swap()`/`fail()` dispatch straight at `editor.view`, which by now is destroyed.
		response$.next(responseEvent(uploaded('file-9')));
		response$.error({ error: { message: 'too late' } });

		expect(editor.view.dispatch).not.toHaveBeenCalled();
		expect(editor.tr.setNodeMarkup).not.toHaveBeenCalled();
	});

	it('ignores a response belonging to a document the editor has moved on from', () => {
		service.handleFiles(asEditor(editor), [file()]);

		// The `page/:id` route changed: the page re-points the parent before the editor
		// is rebuilt. This upload was started for `doc-1` and must not land in `doc-2`.
		service.parentDocumentId = 'doc-2';
		response$.next(responseEvent(uploaded('file-9')));
		response$.complete();

		expect(editor.tr.setNodeMarkup).not.toHaveBeenCalled();
		expect(editor.view.dispatch).not.toHaveBeenCalled();
	});

	it('ignores a late failure for a stale document instead of flagging the new one', () => {
		service.handleFiles(asEditor(editor), [file()]);

		service.parentDocumentId = 'doc-2';
		response$.error({ error: { message: 'rejected' } });

		// `fail()` would have dispatched a `gzUploadStateChanged` meta transaction.
		expect(editor.tr.setMeta).not.toHaveBeenCalled();
		expect(editor.view.dispatch).not.toHaveBeenCalled();
	});

	it('cancels the request when the user removes the placeholder', () => {
		service.handleFiles(asEditor(editor), [file()]);
		const uploadId = editor.nodes[0].attrs['uploadId'] as string;

		service.remove(asEditor(editor), uploadId);

		expect(response$.observed).toBe(false);
		expect(service.hasPending).toBe(false);
	});

	it('leaves nothing in flight after `ngOnDestroy()`', () => {
		service.handleFiles(asEditor(editor), [file()]);

		service.ngOnDestroy();

		expect(response$.observed).toBe(false);
		expect(service.hasPending).toBe(false);
	});
});
