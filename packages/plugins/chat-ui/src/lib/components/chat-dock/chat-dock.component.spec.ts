// The ui-core barrel boots half the app (and needs packages this spec does not): what the card names from it is doubled.
jest.mock('@gauzy/ui-core/core', () => ({ Store: class Store {}, ToastrService: class ToastrService {} }));
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NEVER, of, throwError } from 'rxjs';
import { IChatConversationWithState, IChatMessageWithRelations } from '@gauzy/contracts';
import { Store, ToastrService } from '@gauzy/ui-core/core';
import { CHAT_MESSAGES_POLL_MS } from '../../chat-ui.constants';
import { ChatDockService } from '../../services/chat-dock.service';
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
	const element = () => fixture.nativeElement as HTMLElement;

	beforeEach(async () => {
		jest.useFakeTimers();
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
				{ provide: Store, useValue: { user$: of(null) } },
				{ provide: ToastrService, useValue: { danger: jest.fn() } }
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

	it('names the files of a message sent without text, instead of an empty line', () => {
		const filesOnly = { ...message('m2', ''), attachmentNames: 'plan.pdf\nphoto.png' } as IChatMessageWithRelations;
		api['messages'].mockReturnValue(of({ messages: [filesOnly] }));
		jest.advanceTimersByTime(CHAT_MESSAGES_POLL_MS);
		fixture.detectChanges();

		expect(element().querySelector('[data-test="chat-dock-messages"]')?.textContent).toContain('plan.pdf, photo.png');
	});
});
