// The ui-core barrel boots half the app (and needs packages this spec does not): what the chat names from it is doubled.
jest.mock('@gauzy/ui-core/core', () => ({ Store: class Store {}, ToastrService: class ToastrService {} }));
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NEVER, of, Subject, throwError } from 'rxjs';
import { ChatUiService, ChatUploadAnswer } from '../../services/chat-ui.service';
import { clearDraft, ComposerSubmission, MessageComposerComponent } from './message-composer.component';
import { ChatPresenceService } from '../../services/chat-presence.service';

const PEOPLE = { byEmployee: new Map(), byUser: new Map(), list: [] };

describe('MessageComposerComponent', () => {
	let fixture: ComponentFixture<MessageComposerComponent>;
	let uploads: Subject<ChatUploadAnswer>[];
	let uploadFile: jest.Mock;
	let discardAttachment: jest.Mock;
	let sent: ComposerSubmission[];
	let typed: number;

	beforeEach(async () => {
		// Drafts outlive a composer (the page keeps them): every case starts from an empty one.
		clearDraft('conversation:c1');
		clearDraft('conversation:c2');
		uploads = [];
		uploadFile = jest.fn(() => {
			const upload = new Subject<ChatUploadAnswer>();
			uploads.push(upload);
			return upload.asObservable();
		});
		discardAttachment = jest.fn(() => of({ discarded: true }));
		await TestBed.configureTestingModule({
			imports: [MessageComposerComponent],
			providers: [{ provide: ChatUiService, useValue: { uploadFile, discardAttachment } }, { provide: ChatPresenceService, useValue: { presenceOf: () => 'offline', lastSeenOf: () => null, watch: () => NEVER, apply: () => undefined, applyList: () => undefined } }]
		}).compileComponents();
		fixture = TestBed.createComponent(MessageComposerComponent);
		fixture.componentRef.setInput('people', PEOPLE);
		fixture.componentRef.setInput('draftKey', 'conversation:c1');
		sent = [];
		typed = 0;
		fixture.componentInstance.submitted.subscribe((submission) => sent.push(submission));
		fixture.componentInstance.typing.subscribe(() => (typed += 1));
		fixture.detectChanges();
	});

	const box = (): HTMLTextAreaElement => fixture.nativeElement.querySelector('textarea');
	const text = (): string => (fixture.componentInstance as unknown as { text: string }).text;

	function type(value: string): void {
		const element = box();
		element.value = value;
		element.setSelectionRange(value.length, value.length);
		element.dispatchEvent(new Event('input'));
		fixture.detectChanges();
	}

	/** A key as the browser sends it: down, then up (the box reads the caret again on every keyup). */
	function press(key: string): void {
		box().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
		box().dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }));
		fixture.detectChanges();
	}

	function sendButton(): HTMLButtonElement {
		return fixture.nativeElement.querySelector('[data-test="composer-send"]');
	}

	describe('typing', () => {
		afterEach(() => jest.useRealTimers());

		it('says the person is typing at most once every few seconds, and at once again after a send', () => {
			jest.useFakeTimers({ now: new Date('2026-11-12T10:00:00Z') });
			type('h');
			type('he');
			expect(typed).toBe(1);
			jest.setSystemTime(new Date('2026-11-12T10:00:03.100Z'));
			type('hey');
			expect(typed).toBe(2);
			press('Enter');
			expect(sent).toHaveLength(1);
			type('n');
			expect(typed).toBe(3);
		});

		it('says nothing for an empty box, or while a message is edited', () => {
			type('   ');
			expect(typed).toBe(0);
			fixture.componentRef.setInput('editing', true);
			fixture.componentRef.setInput('initialBody', 'Old text');
			fixture.detectChanges();
			type('Old text, edited');
			expect(typed).toBe(0);
		});
	});

	describe('editing a message that keeps files', () => {
		it('may save it with no text when the message keeps its files, never otherwise', () => {
			fixture.componentRef.setInput('editing', true);
			fixture.componentRef.setInput('initialBody', 'Old text');
			fixture.detectChanges();
			type('');
			expect(sendButton().disabled).toBe(true);
			fixture.componentRef.setInput('keepsFiles', true);
			fixture.detectChanges();
			expect(sendButton().disabled).toBe(false);
			sendButton().click();
			expect(sent).toEqual([{ body: '', mentionEmployeeIds: [], attachmentIds: [] }]);
		});
	});

	describe('emoji', () => {
		it('lists the emoji of a `:` query and puts the one picked with Enter in its place', async () => {
			type('ship it :roc');
			const list = fixture.nativeElement.querySelector('[data-test="emoji-suggestions"]');
			expect(list?.textContent).toContain('🚀');
			press('Enter');
			expect(text()).toBe('ship it 🚀 ');
			expect(fixture.nativeElement.querySelector('[data-test="emoji-suggestions"]')).toBeNull();
			// Enter picked: nothing was sent.
			expect(sent).toEqual([]);
		});

		it('replaces a complete `:name:` as it is typed, and leaves an unknown one', () => {
			type('done :check:');
			expect(text()).toBe('done ✅');
			type('done ✅ :not_an_emoji_name:');
			expect(text()).toBe('done ✅ :not_an_emoji_name:');
		});

		it('closes the list with Escape (its keyup does not open it again), and Enter then sends', () => {
			type(':thu');
			press('Escape');
			expect(fixture.nativeElement.querySelector('[data-test="emoji-suggestions"]')).toBeNull();
			press('Enter');
			expect(sent).toEqual([{ body: ':thu', mentionEmployeeIds: [], attachmentIds: [] }]);
		});

		it('opens the list again once the text changes after an Escape', () => {
			type(':thu');
			press('Escape');
			type(':thumb');
			box().dispatchEvent(new KeyboardEvent('keyup', { key: 'b', bubbles: true }));
			fixture.detectChanges();
			expect(fixture.nativeElement.querySelector('[data-test="emoji-suggestions"]')?.textContent).toContain('👍');
		});
	});

	describe('suggestions and the emoji grid', () => {
		const person = (employeeId: string, name: string) => ({ employeeId, userId: null, name, imageUrl: null });
		const peopleOf = (...list: ReturnType<typeof person>[]) => ({ byEmployee: new Map(list.map((p) => [p.employeeId, p])), byUser: new Map(), list });

		it('picks the first person with Enter when the list shrank under the highlight', () => {
			fixture.componentRef.setInput('people', peopleOf(person('e1', 'Ada Lovelace'), person('e2', 'Alan Turing')));
			fixture.detectChanges();
			type('hi @a');
			press('ArrowDown');
			// The people list changes while the query stays open: one person left, the highlight was on the second.
			fixture.componentRef.setInput('people', peopleOf(person('e1', 'Ada Lovelace')));
			fixture.detectChanges();
			expect(() => press('Enter')).not.toThrow();
			expect(text()).toBe('hi @Ada Lovelace ');
			expect(sent).toEqual([]);
		});

		it('shows the emoji grid in place of an open `:` list', () => {
			type(':thu');
			expect(fixture.nativeElement.querySelector('[data-test="emoji-suggestions"]')).not.toBeNull();
			(fixture.nativeElement.querySelector('[aria-label="CHAT.COMPOSER.EMOJI"]') as HTMLButtonElement).click();
			fixture.detectChanges();
			expect(fixture.nativeElement.querySelector('[data-test="composer-emoji"]')).not.toBeNull();
			expect(fixture.nativeElement.querySelector('[data-test="emoji-suggestions"]')).toBeNull();
		});
	});

	describe('attachments', () => {
		beforeEach(() => {
			fixture.componentRef.setInput('canAttach', true);
			fixture.detectChanges();
		});

		const pdf = () => new File(['%PDF'], 'report.pdf', { type: 'application/pdf' });

		it('offers the paperclip only to someone who may upload', () => {
			expect(fixture.nativeElement.querySelector('[data-test="composer-attach"]')).not.toBeNull();
			fixture.componentRef.setInput('canAttach', false);
			fixture.detectChanges();
			expect(fixture.nativeElement.querySelector('[data-test="composer-attach"]')).toBeNull();
		});

		it('stores each file at once, waits for it, and sends a message of files only with no text', () => {
			fixture.componentInstance.addFiles([pdf()]);
			fixture.detectChanges();
			expect(uploadFile).toHaveBeenCalledTimes(1);
			expect(fixture.nativeElement.querySelector('[data-status="uploading"]')).not.toBeNull();
			expect(sendButton().disabled).toBe(true);

			uploads[0].next({ results: [{ document: { id: 'doc-1' } }], rejected: [] });
			uploads[0].complete();
			fixture.detectChanges();
			expect(sendButton().disabled).toBe(false);
			sendButton().click();
			// The platform takes a message of files only and records their names itself.
			expect(sent).toEqual([{ body: '', mentionEmployeeIds: [], attachmentIds: ['doc-1'] }]);
			// The files went with the message: nothing is discarded.
			expect(discardAttachment).not.toHaveBeenCalled();
		});

		it('discards a stored file taken off before sending, and the stored files left in another place', () => {
			fixture.componentInstance.addFiles([pdf(), pdf()]);
			uploads[0].next({ results: [{ document: { id: 'doc-1' } }], rejected: [] });
			uploads[1].next({ results: [{ document: { id: 'doc-2' } }], rejected: [] });
			fixture.detectChanges();
			(fixture.nativeElement.querySelector('.attachment-remove') as HTMLButtonElement).click();
			fixture.detectChanges();
			expect(discardAttachment.mock.calls).toEqual([['doc-1']]);
			fixture.componentRef.setInput('draftKey', 'conversation:c2');
			fixture.detectChanges();
			expect(discardAttachment.mock.calls).toEqual([['doc-1'], ['doc-2']]);
		});

		it('keeps the files of a send under way, and lets a refused send discard them', () => {
			fixture.componentInstance.addFiles([pdf()]);
			uploads[0].next({ results: [{ document: { id: 'doc-1' } }], rejected: [] });
			fixture.detectChanges();
			sendButton().click();
			// The place sends (busy): taking the file off now discards nothing, the message may carry it.
			fixture.componentRef.setInput('disabled', true);
			fixture.detectChanges();
			(fixture.nativeElement.querySelector('.attachment-remove') as HTMLButtonElement | null)?.click();
			expect(discardAttachment).not.toHaveBeenCalled();
		});

		it('discards the files of a refused send once they are taken off', () => {
			fixture.componentInstance.addFiles([pdf()]);
			uploads[0].next({ results: [{ document: { id: 'doc-1' } }], rejected: [] });
			fixture.detectChanges();
			sendButton().click();
			fixture.componentRef.setInput('disabled', true);
			fixture.detectChanges();
			// The send ends and the composer is not cleared: the place refused it.
			fixture.componentRef.setInput('disabled', false);
			fixture.detectChanges();
			(fixture.nativeElement.querySelector('.attachment-remove') as HTMLButtonElement).click();
			fixture.detectChanges();
			expect(discardAttachment.mock.calls).toEqual([['doc-1']]);
		});

		it('discards nothing of a send that went out, nor of one the person moved on from', () => {
			fixture.componentInstance.addFiles([pdf()]);
			uploads[0].next({ results: [{ document: { id: 'doc-1' } }], rejected: [] });
			fixture.detectChanges();
			sendButton().click();
			fixture.componentRef.setInput('disabled', true);
			fixture.detectChanges();
			// Another place while the send is under way: that send may still land.
			fixture.componentRef.setInput('draftKey', 'conversation:c2');
			fixture.componentRef.setInput('disabled', false);
			fixture.detectChanges();
			expect(discardAttachment).not.toHaveBeenCalled();
		});

		it('leaves a file still uploading to the platform, and a failed discard unnoticed', () => {
			discardAttachment.mockReturnValueOnce(throwError(() => ({ status: 404 })));
			fixture.componentInstance.addFiles([pdf(), pdf()]);
			uploads[0].next({ results: [{ document: { id: 'doc-1' } }], rejected: [] });
			fixture.detectChanges();
			fixture.componentRef.setInput('draftKey', 'conversation:c2');
			expect(() => fixture.detectChanges()).not.toThrow();
			expect(discardAttachment.mock.calls).toEqual([['doc-1']]);
		});

		it('keeps the text written beside the files', () => {
			fixture.componentInstance.addFiles([pdf()]);
			uploads[0].next({ results: [{ document: { id: 'doc-1' } }], rejected: [] });
			type('The report');
			press('Enter');
			expect(sent).toEqual([{ body: 'The report', mentionEmployeeIds: [], attachmentIds: ['doc-1'] }]);
		});

		it('shows a refused file, and sends nothing until it is taken off', () => {
			uploadFile.mockReturnValueOnce(throwError(() => ({ status: 404 })));
			fixture.componentInstance.addFiles([pdf()]);
			fixture.detectChanges();
			const failed = fixture.nativeElement.querySelector('[data-status="failed"]');
			expect(failed?.textContent).toContain('CHAT.COMPOSER.ATTACH_UNAVAILABLE');
			// Text written beside it does not send the message without the file.
			type('Here is the file');
			expect(sendButton().disabled).toBe(true);
			press('Enter');
			expect(sent).toEqual([]);

			failed.querySelector('.attachment-remove').click();
			fixture.detectChanges();
			expect(fixture.nativeElement.querySelector('[data-test="composer-attachments"]')).toBeNull();
			expect(sendButton().disabled).toBe(false);
		});

		it('drops the files picked in another place, and stops their uploads', () => {
			fixture.componentInstance.addFiles([pdf()]);
			expect(uploads[0].observed).toBe(true);
			fixture.componentRef.setInput('draftKey', 'conversation:c2');
			fixture.detectChanges();
			expect(uploads[0].observed).toBe(false);
			expect(fixture.nativeElement.querySelector('[data-test="composer-attachments"]')).toBeNull();
		});

		it('says how many files did not fit the message', () => {
			const many = Array.from({ length: 12 }, (_, index) => new File(['x'], `f${index}.txt`, { type: 'text/plain' }));
			fixture.componentInstance.addFiles(many);
			fixture.detectChanges();
			expect(uploadFile).toHaveBeenCalledTimes(10);
			expect(fixture.nativeElement.querySelector('.hint')?.textContent).toContain('CHAT.COMPOSER.TOO_MANY_FILES');
		});

		it('takes no files while a message is edited', () => {
			fixture.componentRef.setInput('editing', true);
			fixture.componentRef.setInput('initialBody', 'Old text');
			fixture.detectChanges();
			fixture.componentInstance.addFiles([pdf()]);
			expect(uploadFile).not.toHaveBeenCalled();
			expect(fixture.nativeElement.querySelector('[data-test="composer-attach"]')).toBeNull();
		});
	});
});
