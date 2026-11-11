// The ui-core barrel boots half the app (and needs packages this spec does not): what the chat names from it is doubled.
jest.mock('@gauzy/ui-core/core', () => ({ Store: class Store {}, ToastrService: class ToastrService {} }));
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, throwError } from 'rxjs';
import { ChatUiService, ChatUploadAnswer } from '../../services/chat-ui.service';
import { clearDraft, ComposerSubmission, MessageComposerComponent } from './message-composer.component';

const PEOPLE = { byEmployee: new Map(), byUser: new Map(), list: [] };

describe('MessageComposerComponent', () => {
	let fixture: ComponentFixture<MessageComposerComponent>;
	let uploads: Subject<ChatUploadAnswer>[];
	let uploadFile: jest.Mock;
	let sent: ComposerSubmission[];

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
		await TestBed.configureTestingModule({
			imports: [MessageComposerComponent],
			providers: [{ provide: ChatUiService, useValue: { uploadFile } }]
		}).compileComponents();
		fixture = TestBed.createComponent(MessageComposerComponent);
		fixture.componentRef.setInput('people', PEOPLE);
		fixture.componentRef.setInput('draftKey', 'conversation:c1');
		sent = [];
		fixture.componentInstance.submitted.subscribe((submission) => sent.push(submission));
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

	function press(key: string): void {
		box().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
		fixture.detectChanges();
	}

	function sendButton(): HTMLButtonElement {
		return fixture.nativeElement.querySelector('[data-test="composer-send"]');
	}

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

		it('closes the list with Escape, and Enter then sends', () => {
			type(':thu');
			press('Escape');
			expect(fixture.nativeElement.querySelector('[data-test="emoji-suggestions"]')).toBeNull();
			press('Enter');
			expect(sent).toEqual([{ body: ':thu', mentionEmployeeIds: [], attachmentIds: [] }]);
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

		it('stores each file at once, waits for it, and sends its document with the file names as the text', () => {
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
			expect(sent).toEqual([{ body: '📎 report.pdf', mentionEmployeeIds: [], attachmentIds: ['doc-1'] }]);
		});

		it('keeps the text written beside the files', () => {
			fixture.componentInstance.addFiles([pdf()]);
			uploads[0].next({ results: [{ document: { id: 'doc-1' } }], rejected: [] });
			type('The report');
			press('Enter');
			expect(sent).toEqual([{ body: 'The report', mentionEmployeeIds: [], attachmentIds: ['doc-1'] }]);
		});

		it('shows a refused file, sends without it, and lets it be taken off', () => {
			uploadFile.mockReturnValueOnce(throwError(() => ({ status: 404 })));
			fixture.componentInstance.addFiles([pdf()]);
			fixture.detectChanges();
			const failed = fixture.nativeElement.querySelector('[data-status="failed"]');
			expect(failed?.textContent).toContain('CHAT.COMPOSER.ATTACH_UNAVAILABLE');
			// Nothing to send: no text, no stored file.
			expect(sendButton().disabled).toBe(true);

			failed.querySelector('button').click();
			fixture.detectChanges();
			expect(fixture.nativeElement.querySelector('[data-test="composer-attachments"]')).toBeNull();
		});

		it('drops the files picked in another place, and stops their uploads', () => {
			fixture.componentInstance.addFiles([pdf()]);
			expect(uploads[0].observed).toBe(true);
			fixture.componentRef.setInput('draftKey', 'conversation:c2');
			fixture.detectChanges();
			expect(uploads[0].observed).toBe(false);
			expect(fixture.nativeElement.querySelector('[data-test="composer-attachments"]')).toBeNull();
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
