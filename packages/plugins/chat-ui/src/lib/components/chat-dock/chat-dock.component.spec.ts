// The ui-core barrel boots half the app (and needs packages this spec does not): what the card names from it is doubled.
jest.mock('@gauzy/ui-core/core', () => ({ Store: class Store {}, ToastrService: class ToastrService {} }));
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NEVER, of, throwError } from 'rxjs';
import { IChatConversationWithState, IChatFile, IChatMessageWithRelations } from '@gauzy/contracts';
import { Store, ToastrService } from '@gauzy/ui-core/core';
import { CHAT_MESSAGES_POLL_MS } from '../../chat-ui.constants';
import { ChatDockService } from '../../services/chat-dock.service';
import { ChatFilesStore } from '../../services/chat-files.store';
import { ChatTasksService } from '../../services/chat-tasks.service';
import { ChatUiService } from '../../services/chat-ui.service';
import { ChatDockComponent } from './chat-dock.component';
import { ChatPresenceService } from '../../services/chat-presence.service';

const ANNA = { employeeId: 'e-anna', userId: 'u-anna', name: 'Anna', imageUrl: null };
const CONVERSATION = { id: 'c1' } as IChatConversationWithState;
const message = (id: string, body: string) =>
	({ id, body, authorUserId: ANNA.userId, createdAt: new Date(), deletedAt: null }) as unknown as IChatMessageWithRelations;

describe('ChatDockComponent', () => {
	let fixture: ComponentFixture<ChatDockComponent>;
	let api: Record<string, jest.Mock>;
	let files: { byDocument: ReturnType<typeof signal<ReadonlyMap<string, IChatFile>>>; ensureFor: jest.Mock };
	const element = () => fixture.nativeElement as HTMLElement;

	beforeEach(async () => {
		jest.useFakeTimers();
		files = { byDocument: signal<ReadonlyMap<string, IChatFile>>(new Map()), ensureFor: jest.fn() };
		api = {
			direct: jest.fn(() => of({ conversation: CONVERSATION, created: false })),
			// The first read of the messages fails.
			messages: jest.fn(() => throwError(() => ({ status: 503 }))),
			read: jest.fn(() => of({})),
			send: jest.fn(),
			notifyChanged: jest.fn()
		};
		await TestBed.configureTestingModule({
			imports: [ChatDockComponent],
			providers: [
				{ provide: ChatUiService, useValue: api },
				{ provide: ChatPresenceService, useValue: { presenceOf: () => 'offline', lastSeenOf: () => null, watch: () => NEVER, apply: () => undefined, applyList: () => undefined } },
				{ provide: ChatDockService, useValue: { person: signal(ANNA), close: jest.fn() } },
				{ provide: Store, useValue: { user$: of(null), selectedOrganization$: of(null), userRolePermissions$: of([]), hasPermission: () => false } },
				{ provide: ToastrService, useValue: { danger: jest.fn() } },
				{ provide: ChatFilesStore, useValue: files },
				{ provide: ChatTasksService, useValue: { summaries: signal(new Map()), ensure: jest.fn() } }
			]
		}).compileComponents();
		fixture = TestBed.createComponent(ChatDockComponent);
		fixture.detectChanges();
	});

	afterEach(() => {
		fixture.destroy();
		jest.useRealTimers();
	});

	it('keeps reading after a first read of the messages failed, and shows them once one succeeds', () => {
		expect(api['messages']).toHaveBeenCalledTimes(1);
		expect(element().querySelector('.note')).not.toBeNull();
		expect(element().querySelector('[data-test="chat-dock-messages"]')).toBeNull();

		api['messages'].mockReturnValue(of({ messages: [message('m1', 'Hello')] }));
		jest.advanceTimersByTime(CHAT_MESSAGES_POLL_MS);
		fixture.detectChanges();

		expect(api['messages']).toHaveBeenCalledTimes(2);
		expect(element().querySelector('.note')).toBeNull();
		expect(element().querySelector('[data-test="chat-dock-messages"]')?.textContent).toContain('Hello');
	});

	it('draws the messages as the conversation does: its message component, grouped, under a day divider, read only', () => {
		const later = { ...message('m2', 'Still there?'), createdAt: new Date(Date.now() + 1000) } as IChatMessageWithRelations;
		api['messages'].mockReturnValue(of({ messages: [message('m1', 'Hello'), later] }));
		jest.advanceTimersByTime(CHAT_MESSAGES_POLL_MS);
		fixture.detectChanges();

		const items = element().querySelectorAll('[data-test="chat-dock-messages"] ngx-chat-message-item');
		expect(items.length).toBe(2);
		// The second continues the first one's group: no second heading.
		expect(items[1].querySelector('.message.continued')).not.toBeNull();
		expect(element().querySelectorAll('[data-test="chat-dock-messages"] .day-divider').length).toBe(1);
		// Read only: no toolbar to react, pin, edit or delete from the card.
		expect(element().querySelector('[data-test="chat-dock-messages"] .toolbar')).toBeNull();
	});

	it('shows the picture a message carries, read through the conversation', () => {
		const withPicture = { ...message('m3', ''), attachmentIds: ['d1'], attachmentNames: 'photo.png' } as unknown as IChatMessageWithRelations;
		api['messages'].mockReturnValue(of({ messages: [withPicture] }));
		jest.advanceTimersByTime(CHAT_MESSAGES_POLL_MS);
		fixture.detectChanges();

		expect(files.ensureFor).toHaveBeenCalledWith('c1', [withPicture]);

		files.byDocument.set(new Map([['d1', { documentId: 'd1', name: 'photo.png', mimeType: 'image/png', fileUrl: 'https://files.test/photo.png', thumbUrl: null } as unknown as IChatFile]]));
		fixture.detectChanges();

		const picture = element().querySelector<HTMLImageElement>('[data-test="attachment-images"] img');
		expect(picture?.getAttribute('src')).toBe('https://files.test/photo.png');
	});
});
