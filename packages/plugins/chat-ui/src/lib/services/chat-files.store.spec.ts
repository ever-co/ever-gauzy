// The ui-core barrel boots half the app (and needs packages this spec does not): only `Store` is named, and doubled.
jest.mock('@gauzy/ui-core/core', () => ({ Store: class Store {} }));
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, Observable, of, Subject, throwError } from 'rxjs';
import { IChatFile, IChatFilesResult } from '@gauzy/contracts';
import { ChatAvailabilityService, ChatScope } from './chat-availability.service';
import { CHAT_FILES_READ, ChatFilesStore } from './chat-files.store';
import { ChatUiService } from './chat-ui.service';

function file(documentId: string): IChatFile {
	return { documentId, messageId: 'm1', conversationId: 'c1', name: documentId, attachedAt: new Date() };
}

describe('ChatFilesStore', () => {
	let answers: Array<() => Observable<IChatFilesResult>>;
	let files: jest.Mock;
	let scope$: BehaviorSubject<ChatScope | null>;
	let store: ChatFilesStore;

	beforeEach(() => {
		answers = [];
		files = jest.fn(() => (answers.shift() ?? (() => of({ files: [], hasMore: false })))());
		scope$ = new BehaviorSubject<ChatScope | null>({ userId: 'u1', organizationId: 'o1' });
		TestBed.configureTestingModule({
			providers: [
				{ provide: ChatUiService, useValue: { files } },
				{ provide: ChatAvailabilityService, useValue: { scope$: scope$.asObservable() } }
			]
		});
		store = TestBed.inject(ChatFilesStore);
	});

	it('reads the newest files of a conversation once a message names a document it does not know', () => {
		answers.push(() => of({ files: [file('d1'), file('d2')], hasMore: false }));
		store.ensureFor('c1', [{ attachmentIds: ['d1'] }, { attachmentIds: null }]);
		expect(files).toHaveBeenCalledWith('c1', { limit: CHAT_FILES_READ });
		expect([...store.byDocument().keys()]).toEqual(['d1', 'd2']);

		// Known documents, and messages without files, read nothing more.
		store.ensureFor('c1', [{ attachmentIds: ['d2'] }, {}]);
		expect(files).toHaveBeenCalledTimes(1);
	});

	it('does not ask again for a document a read did not answer (deleted since, or older than a read)', () => {
		store.ensure('c1', ['gone']);
		store.ensure('c1', ['gone']);
		expect(files).toHaveBeenCalledTimes(1);

		// A failed read does not loop either.
		answers.push(() => throwError(() => new Error('500')));
		store.ensure('c2', ['d9']);
		store.ensure('c2', ['d9']);
		expect(files).toHaveBeenCalledTimes(2);
	});

	it('reads again, once its read ended, for a document named while it ran', () => {
		const first = new Subject<IChatFilesResult>();
		answers.push(() => first);
		answers.push(() => of({ files: [file('d1'), file('d3')], hasMore: false }));
		store.ensure('c1', ['d1']);
		store.ensure('c1', ['d3']);
		store.ensure('c1', ['d1']);
		expect(files).toHaveBeenCalledTimes(1);

		first.next({ files: [file('d1')], hasMore: false });
		first.complete();
		expect(files).toHaveBeenCalledTimes(2);
		expect(store.byDocument().has('d3')).toBe(true);
	});

	it('keeps the files another part read, and drops everything for another user or organization', () => {
		store.add([file('d5')]);
		store.ensure('c1', ['d5']);
		expect(files).not.toHaveBeenCalled();

		const late = new Subject<IChatFilesResult>();
		answers.push(() => late);
		store.ensure('c1', ['d6']);
		scope$.next({ userId: 'u1', organizationId: 'o2' });
		expect(store.byDocument().size).toBe(0);
		// The answer of the earlier scope is dropped.
		late.next({ files: [file('d6')], hasMore: false });
		late.complete();
		expect(store.byDocument().size).toBe(0);
	});
});
