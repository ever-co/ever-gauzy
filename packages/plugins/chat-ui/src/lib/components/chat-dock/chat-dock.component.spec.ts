// The ui-core barrel boots half the app (and needs packages this spec does not): what the card names from it is doubled.
jest.mock('@gauzy/ui-core/core', () => ({ Store: class Store {}, ToastrService: class ToastrService {} }));
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NEVER, of, Subject, throwError, timer } from 'rxjs';
import { map } from 'rxjs/operators';
import { CHAT_EVENT_NAMES, IChatConversationWithState, IChatFile, IChatMessageWithRelations } from '@gauzy/contracts';
import { Store, ToastrService } from '@gauzy/ui-core/core';
import { Router } from '@angular/router';
import { CHAT_DOCK_PAGE_SIZE, CHAT_LINK, CHAT_LIVE_AUDIT_MS, CHAT_MESSAGES_POLL_MS } from '../../chat-ui.constants';
import { ChatCreateTaskFlow } from '../../dialogs/chat-task-dialogs.component';
import * as helpers from '../../chat-ui.helpers';
import { ChatDockService } from '../../services/chat-dock.service';
import { ChatFilesStore } from '../../services/chat-files.store';
import { ChatHint } from '../../services/chat-live';
import { ChatLiveService } from '../../services/chat-live.service';
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
	let hints$: Subject<Partial<ChatHint>>;
	let catchUp$: Subject<void>;
	let tasks: { summaries: ReturnType<typeof signal>; ensure: jest.Mock; refreshAll: jest.Mock; refreshShownBy: jest.Mock };
	const element = () => fixture.nativeElement as HTMLElement;

	beforeEach(async () => {
		jest.useFakeTimers();
		hints$ = new Subject();
		catchUp$ = new Subject();
		tasks = { summaries: signal(new Map()), ensure: jest.fn(), refreshAll: jest.fn(), refreshShownBy: jest.fn() };
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
				{ provide: ChatTasksService, useValue: tasks },
				{ provide: ChatCreateTaskFlow, useValue: { open: jest.fn(() => NEVER) } },
				// No live events here (the poll's fallback pace), unless a test sends one.
				{ provide: ChatLiveService, useValue: { ticks: (ms: number) => timer(ms, ms).pipe(map(() => undefined)), hints$, catchUp$ } }
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

	it('draws the messages as the conversation does: its message component, grouped, under a day divider, with its toolbar', () => {
		const later = { ...message('m2', 'Still there?'), createdAt: new Date(Date.now() + 1000) } as IChatMessageWithRelations;
		api['messages'].mockReturnValue(of({ messages: [message('m1', 'Hello'), later] }));
		jest.advanceTimersByTime(CHAT_MESSAGES_POLL_MS);
		fixture.detectChanges();

		const items = element().querySelectorAll('[data-test="chat-dock-messages"] ngx-chat-message-item');
		expect(items.length).toBe(2);
		// The second continues the first one's group: no second heading.
		expect(items[1].querySelector('.message.continued')).not.toBeNull();
		expect(element().querySelectorAll('[data-test="chat-dock-messages"] .day-divider').length).toBe(1);
		// The toolbar of each message, as in the chat: react, reply, pin...
		expect(items[0].querySelector('.toolbar [data-test="react"]')).not.toBeNull();
		expect(items[0].querySelector('.toolbar [data-test="reply"]')).not.toBeNull();
		expect(items[0].querySelector('.toolbar [data-test="pin"]')).not.toBeNull();
	});

	it('reacts to a message from its toolbar and shows the reaction', () => {
		api['messages'].mockReturnValue(of({ messages: [message('m1', 'Hello')] }));
		jest.advanceTimersByTime(CHAT_MESSAGES_POLL_MS);
		fixture.detectChanges();
		const reacted = { ...message('m1', 'Hello'), reactions: [{ emoji: '👍', count: 1, mine: true }] } as unknown as IChatMessageWithRelations;
		api['react'] = jest.fn(() => of({ message: reacted }));

		element().querySelector<HTMLButtonElement>('[data-test="chat-dock-messages"] .toolbar .tool.emoji')?.click();
		fixture.detectChanges();

		expect(api['react']).toHaveBeenCalledWith('m1', expect.any(String), true);
		expect(element().querySelector('[data-test="chat-dock-messages"] [data-test="reactions"]')?.textContent).toContain('👍');
	});

	it('opens the thread of a message in the chat, the card giving way', () => {
		api['messages'].mockReturnValue(of({ messages: [message('m1', 'Hello')] }));
		jest.advanceTimersByTime(CHAT_MESSAGES_POLL_MS);
		fixture.detectChanges();
		const navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

		element().querySelector<HTMLButtonElement>('[data-test="chat-dock-messages"] [data-test="reply"]')?.click();

		expect(TestBed.inject(ChatDockService).close).toHaveBeenCalled();
		expect(navigate).toHaveBeenCalledWith([CHAT_LINK, 'c1'], { queryParams: { thread: 'm1' } });
	});

	it('opens the thread a reply also sent to the conversation belongs to, not the reply itself', () => {
		const reply = { ...message('r1', 'In the thread too'), threadRootId: 'root1', alsoInConversation: true } as IChatMessageWithRelations;
		api['messages'].mockReturnValue(of({ messages: [reply] }));
		jest.advanceTimersByTime(CHAT_MESSAGES_POLL_MS);
		fixture.detectChanges();
		const navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

		fixture.componentInstance['onAction'](reply, { kind: 'reply' });

		expect(navigate).toHaveBeenCalledWith([CHAT_LINK, 'c1'], { queryParams: { thread: 'root1' } });
	});

	it('reads the latest page again on an event of its conversation, not on one of another', () => {
		api['messages'].mockReturnValue(of({ messages: [message('m1', 'Hello')] }));
		jest.advanceTimersByTime(CHAT_MESSAGES_POLL_MS);
		api['messages'].mockClear();

		hints$.next({ conversationId: 'other', name: CHAT_EVENT_NAMES.MESSAGE_CREATED });
		jest.advanceTimersByTime(CHAT_LIVE_AUDIT_MS);
		expect(api['messages']).not.toHaveBeenCalled();

		// Two events close together: one read.
		hints$.next({ conversationId: 'c1', name: CHAT_EVENT_NAMES.MESSAGE_CREATED });
		hints$.next({ conversationId: 'c1', name: CHAT_EVENT_NAMES.MESSAGE_CREATED });
		jest.advanceTimersByTime(CHAT_LIVE_AUDIT_MS);
		expect(api['messages']).toHaveBeenCalledTimes(1);
		expect(api['messages']).toHaveBeenCalledWith('c1', { limit: CHAT_DOCK_PAGE_SIZE });
	});

	it('lets a slow read finish, and reads once more after it for what came meanwhile', () => {
		const slow = new Subject<{ messages: IChatMessageWithRelations[] }>();
		api['messages'].mockReturnValue(slow);
		jest.advanceTimersByTime(CHAT_MESSAGES_POLL_MS);
		expect(api['messages']).toHaveBeenCalledTimes(2);

		// Ticks and an event while it runs: none of them cancels it or starts another.
		jest.advanceTimersByTime(CHAT_MESSAGES_POLL_MS * 3);
		hints$.next({ conversationId: 'c1', name: CHAT_EVENT_NAMES.MESSAGE_CREATED });
		jest.advanceTimersByTime(CHAT_LIVE_AUDIT_MS);
		expect(api['messages']).toHaveBeenCalledTimes(2);
		expect(slow.observed).toBe(true);

		api['messages'].mockReturnValue(of({ messages: [message('m2', 'Later')] }));
		slow.next({ messages: [message('m1', 'Hello')] });
		slow.complete();
		fixture.detectChanges();

		// Its answer shows, and one more read follows for the triggers that came while it ran.
		expect(api['messages']).toHaveBeenCalledTimes(3);
		expect(element().querySelector('[data-test="chat-dock-messages"]')?.textContent).toContain('Later');
	});

	it('reads the task cards again on an update of a message and after a catch-up, not on a tick', () => {
		api['messages'].mockReturnValue(of({ messages: [message('m1', 'Hello')] }));
		jest.advanceTimersByTime(CHAT_MESSAGES_POLL_MS * 2);
		expect(tasks.refreshAll).not.toHaveBeenCalled();
		expect(tasks.refreshShownBy).not.toHaveBeenCalled();

		hints$.next({ conversationId: 'c1', name: CHAT_EVENT_NAMES.MESSAGE_UPDATED, messageId: 'm1' });
		expect(tasks.refreshShownBy).toHaveBeenCalledWith([expect.objectContaining({ id: 'm1' })], 'm1');

		catchUp$.next();
		expect(tasks.refreshAll).toHaveBeenCalledTimes(1);
		jest.advanceTimersByTime(CHAT_MESSAGES_POLL_MS);
		expect(tasks.refreshAll).toHaveBeenCalledTimes(1);
	});

	it('drops a message the newest page no longer holds', () => {
		api['messages'].mockReturnValue(of({ messages: [message('m1', 'Hello'), message('m2', 'Deleted soon')] }));
		jest.advanceTimersByTime(CHAT_MESSAGES_POLL_MS);
		fixture.detectChanges();
		expect(element().querySelectorAll('[data-test="chat-dock-messages"] ngx-chat-message-item').length).toBe(2);

		api['messages'].mockReturnValue(of({ messages: [message('m1', 'Hello')] }));
		jest.advanceTimersByTime(CHAT_MESSAGES_POLL_MS);
		fixture.detectChanges();

		expect(element().querySelectorAll('[data-test="chat-dock-messages"] ngx-chat-message-item').length).toBe(1);
	});

	it('drops a deleted message even when it was the newest, and keeps one sent here only for a read already under way', () => {
		const at = (seconds: number) => new Date(Date.now() + seconds * 1000);
		const first = { ...message('m1', 'Hello'), createdAt: at(1) } as IChatMessageWithRelations;
		const newest = { ...message('m2', 'Deleted soon'), createdAt: at(2) } as IChatMessageWithRelations;
		api['messages'].mockReturnValue(of({ messages: [first, newest] }));
		jest.advanceTimersByTime(CHAT_MESSAGES_POLL_MS);
		const card = fixture.componentInstance;
		expect(card['messages']().map((item) => item.id)).toEqual(['m1', 'm2']);

		// The newest one was deleted: the page no longer holds it, though it is newer than all of the page.
		api['messages'].mockReturnValue(of({ messages: [{ ...first }] }));
		jest.advanceTimersByTime(CHAT_MESSAGES_POLL_MS);
		expect(card['messages']().map((item) => item.id)).toEqual(['m1']);

		// One sent here while a read was under way stays when that read's page does not hold it yet.
		const pending = new Subject<{ messages: IChatMessageWithRelations[] }>();
		api['messages'].mockReturnValue(pending);
		jest.advanceTimersByTime(CHAT_MESSAGES_POLL_MS);
		const sent = { ...message('m3', 'Sent'), createdAt: at(3) } as IChatMessageWithRelations;
		api['send'].mockReturnValue(of({ message: sent }));
		card['send']({ body: 'Sent', mentionEmployeeIds: [], attachmentIds: [] });
		pending.next({ messages: [{ ...first }] });
		pending.complete();
		expect(card['messages']().map((item) => item.id)).toEqual(['m1', 'm3']);

		// A read started after it landed that does not hold it: it was deleted (elsewhere) before any page held it.
		api['messages'].mockReturnValue(of({ messages: [{ ...first }] }));
		jest.advanceTimersByTime(CHAT_MESSAGES_POLL_MS);
		expect(card['messages']().map((item) => item.id)).toEqual(['m1']);
	});

	it('keeps a message sent here when a read of the empty conversation answers after it', () => {
		const empty = new Subject<{ messages: IChatMessageWithRelations[] }>();
		api['messages'].mockReturnValue(empty);
		jest.advanceTimersByTime(CHAT_MESSAGES_POLL_MS);
		expect(api['messages']).toHaveBeenCalledTimes(2);
		const card = fixture.componentInstance;

		// The first message is sent while that read is under way, and lands first.
		api['send'].mockReturnValue(of({ message: message('m1', 'First') }));
		card['send']({ body: 'First', mentionEmployeeIds: [], attachmentIds: [] });
		expect(card['messages']().map((item) => item.id)).toEqual(['m1']);

		// The read answers the conversation as it was when it began: empty. The message sent stays.
		empty.next({ messages: [] });
		empty.complete();
		expect(card['messages']().map((item) => item.id)).toEqual(['m1']);

		// A read started after the send that is still empty: the message was deleted since, and leaves.
		api['messages'].mockReturnValue(of({ messages: [] }));
		jest.advanceTimersByTime(CHAT_MESSAGES_POLL_MS);
		expect(card['messages']()).toEqual([]);
	});

	it('applies only the fields a follow or a deletion changed, over a refresh that came meanwhile', () => {
		api['messages'].mockReturnValue(of({ messages: [message('m1', 'Hello')] }));
		jest.advanceTimersByTime(CHAT_MESSAGES_POLL_MS);
		const card = fixture.componentInstance;
		const followed = new Subject<unknown>();
		const removed = new Subject<unknown>();
		api['setFollowing'] = jest.fn(() => followed);
		api['remove'] = jest.fn(() => removed);
		const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);

		card['onAction'](card['messages']()[0], { kind: 'follow', following: true });
		card['onAction'](card['messages']()[0], { kind: 'delete' });
		// A refresh lands while both are under way: the message was edited and reacted to.
		const refreshed = { ...message('m1', 'Edited'), reactions: [{ emoji: '👍', count: 1, mine: false }] } as unknown as IChatMessageWithRelations;
		api['messages'].mockReturnValue(of({ messages: [refreshed] }));
		jest.advanceTimersByTime(CHAT_MESSAGES_POLL_MS);

		followed.next({});
		expect(card['messages']()[0]).toMatchObject({ body: 'Edited', following: true });
		removed.next({});
		expect(card['messages']()[0]).toMatchObject({ body: '', following: true, reactions: [{ emoji: '👍', count: 1, mine: false }] });
		expect(card['messages']()[0].deletedAt).toBeTruthy();
		confirm.mockRestore();
	});

	it('ends only the edit that was saved: another message picked meanwhile stays in edit', () => {
		const first = message('m1', 'First');
		const second = message('m2', 'Second');
		api['messages'].mockReturnValue(of({ messages: [first, second] }));
		jest.advanceTimersByTime(CHAT_MESSAGES_POLL_MS);
		fixture.detectChanges();
		const saving = new Subject<{ message: IChatMessageWithRelations }>();
		api['edit'] = jest.fn(() => saving);
		const card = fixture.componentInstance;

		card['onAction'](first, { kind: 'edit' });
		card['send']({ body: 'First, edited', mentionEmployeeIds: [], attachmentIds: [] });
		card['onAction'](second, { kind: 'edit' });
		saving.next({ message: { ...first, body: 'First, edited' } });
		saving.complete();

		expect(card['editing']()?.id).toBe('m2');
	});

	it('does not render the messages again when a read again changes nothing', () => {
		const at = new Date();
		// Every read answers new objects, as the API does.
		api['messages'].mockImplementation(() => of({ messages: [{ ...message('m1', 'Hello'), createdAt: at }, { ...message('m2', '**Still** there?'), createdAt: at }] }));
		jest.advanceTimersByTime(CHAT_MESSAGES_POLL_MS);
		fixture.detectChanges();
		expect(element().querySelector('[data-test="chat-dock-messages"]')?.textContent).toContain('Hello');

		const render = jest.spyOn(helpers, 'renderBodyHtml');
		jest.advanceTimersByTime(CHAT_MESSAGES_POLL_MS * 3);
		fixture.detectChanges();

		// The bodies were not parsed and sanitized again.
		expect(render).not.toHaveBeenCalled();
		render.mockRestore();
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
