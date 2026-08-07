/**
 * `@gauzy/ui-core/core` is a barrel over the whole app core — importing it (via
 * `DocumentsService`, which is only ever a DI token here) pulls Akita's
 * untranspiled ESM into the CommonJS test runtime.
 */
jest.mock('@gauzy/ui-core/core', () => ({ Store: class Store {} }));

import { HttpErrorResponse } from '@angular/common/http';
import { Injector, NgZone } from '@angular/core';
import { fakeAsync, tick } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { IDocument } from '@gauzy/contracts';
import { DocumentsService } from '../../services/documents.service';
import { DocumentAutosaveService, IAutosavePayload } from './document-autosave.service';

/**
 * Autosave state-machine tests (05-editor-spec.md §9.2). These cover the three
 * ways the machine used to strand a user's edits: an early return that left no
 * timer armed, a 423 freeze with no path back, and a save from the previous
 * document landing after the editor was rebuilt for another `page/:id`.
 */
describe('DocumentAutosaveService', () => {
	const LOADED_AT = '2026-01-01T00:00:00.000Z';
	const SAVED_AT = '2026-01-01T00:00:10.000Z';

	let updateContent: jest.Mock;
	let service: DocumentAutosaveService;

	const payload = (): IAutosavePayload => ({
		contentJson: { type: 'doc', content: [] } as never,
		contentHtml: '<p>hello</p>',
		mentionEmployeeIds: []
	});

	/** The service only uses the zone to hop in and out of it — running straight
	 *  through keeps the timers under `fakeAsync`'s control. */
	const zone = {
		run: <T>(fn: () => T): T => fn(),
		runOutsideAngular: <T>(fn: () => T): T => fn()
	} as unknown as NgZone;

	beforeEach(() => {
		updateContent = jest.fn(() => of({ id: 'doc-1', updatedAt: SAVED_AT } as unknown as IDocument));
		const injector = Injector.create({
			providers: [
				{ provide: DocumentsService, useValue: { updateContent } },
				{ provide: NgZone, useValue: zone },
				{ provide: DocumentAutosaveService, useClass: DocumentAutosaveService, deps: [] }
			]
		});
		service = injector.get(DocumentAutosaveService);
	});

	it('saves once the debounce elapses and reports the new token', fakeAsync(() => {
		service.init('doc-1', LOADED_AT, payload);
		service.markDirty();
		expect(service.state).toBe('dirty');

		tick(2_000);

		expect(updateContent).toHaveBeenCalledTimes(1);
		expect(updateContent).toHaveBeenCalledWith('doc-1', expect.objectContaining({ expectedUpdatedAt: LOADED_AT }));
		expect(service.state).toBe('saved');
		expect(service.updatedAt).toBe(SAVED_AT);
	}));

	it('retries instead of stranding the edit when the payload is withheld (uploads pending)', fakeAsync(() => {
		let uploading = true;
		service.init('doc-1', LOADED_AT, () => (uploading ? null : payload()));
		service.markDirty();

		tick(2_000);
		// The flush returned early — nothing saved, but the document is still dirty…
		expect(updateContent).not.toHaveBeenCalled();
		expect(service.isDirty).toBe(true);

		// …and a timer is still armed, so the upload finishing is enough: no further
		// keystroke (no `markDirty`) is needed to get the content persisted.
		uploading = false;
		tick(2_000);

		expect(updateContent).toHaveBeenCalledTimes(1);
		expect(service.state).toBe('saved');
	}));

	it('keeps retrying across several blocked flushes', fakeAsync(() => {
		let uploading = true;
		service.init('doc-1', LOADED_AT, () => (uploading ? null : payload()));
		service.markDirty();

		tick(20_000); // several debounce + ceiling windows, all blocked
		expect(updateContent).not.toHaveBeenCalled();

		uploading = false;
		tick(2_000);
		expect(updateContent).toHaveBeenCalledTimes(1);
	}));

	it('thaws a 423 freeze when the page releases the lock', fakeAsync(() => {
		updateContent.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 423 })));
		service.init('doc-1', LOADED_AT, payload);
		service.markDirty();

		tick(2_000);
		expect(service.state).toBe('locked');

		// Frozen: further edits neither save nor re-arm anything.
		service.markDirty();
		tick(20_000);
		expect(updateContent).toHaveBeenCalledTimes(1);

		service.lockReleased(SAVED_AT);
		expect(service.state).toBe('dirty');

		tick(2_000);
		expect(updateContent).toHaveBeenCalledTimes(2);
		expect(updateContent).toHaveBeenLastCalledWith(
			'doc-1',
			expect.objectContaining({ expectedUpdatedAt: SAVED_AT })
		);
	}));

	it('leaves a 409 conflict frozen — only the page resolves that one', fakeAsync(() => {
		updateContent.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 409 })));
		service.init('doc-1', LOADED_AT, payload);
		service.markDirty();

		tick(2_000);
		expect(service.state).toBe('conflict');

		service.lockReleased(SAVED_AT);
		expect(service.state).toBe('conflict');
	}));

	it('ignores a save that lands after the editor moved to another document', fakeAsync(() => {
		const pending = new Subject<IDocument>();
		updateContent.mockReturnValueOnce(pending.asObservable());

		service.init('doc-1', LOADED_AT, payload);
		service.markDirty();
		tick(2_000);
		expect(updateContent).toHaveBeenCalledWith('doc-1', expect.objectContaining({ expectedUpdatedAt: LOADED_AT }));

		// The route ':id' changed and the editor rebuilt for another document.
		const secondLoadedAt = '2026-02-02T00:00:00.000Z';
		service.init('doc-2', secondLoadedAt, payload);

		// The first document's save now answers — it must not write this session.
		pending.next({ id: 'doc-1', updatedAt: SAVED_AT } as unknown as IDocument);
		pending.complete();
		tick();

		expect(service.updatedAt).toBe(secondLoadedAt);
		expect(service.state).toBe('idle');

		// …and it must not have left the single-flight latch closed.
		service.markDirty();
		tick(2_000);
		expect(updateContent).toHaveBeenLastCalledWith(
			'doc-2',
			expect.objectContaining({ expectedUpdatedAt: secondLoadedAt })
		);
	}));
});
