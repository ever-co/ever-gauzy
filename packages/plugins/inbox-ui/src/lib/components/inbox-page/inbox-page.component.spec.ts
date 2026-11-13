import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { IInboxItemWithState, InboxItemKindEnum, InboxItemStatusEnum, InboxTabEnum } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { InboxEmailAvailabilityService } from '../../services/inbox-email-availability.service';
import { InboxNotificationsService, InboxUiService } from '../../services/inbox-ui.service';
import { apiMessage, InboxPageComponent } from './inbox-page.component';

const item = (id: string, overrides: Partial<IInboxItemWithState> = {}): IInboxItemWithState =>
	({
		id,
		kind: InboxItemKindEnum.QUESTION,
		source: 'GAUZY',
		status: InboxItemStatusEnum.OPEN,
		title: `Item ${id}`,
		priority: 'normal',
		bodyFormat: 'plain',
		recipient: { isRead: false, isArchived: false, snoozedUntil: null },
		...overrides
	}) as IInboxItemWithState;

/** The Inbox page: nothing but the "off" notice where the API does not serve the Inbox. */
describe('InboxPageComponent', () => {
	const api = {
		counts: jest.fn(),
		list: jest.fn(),
		get: jest.fn(),
		reply: jest.fn(),
		setState: jest.fn(),
		markAllRead: jest.fn(),
		notifyChanged: jest.fn(),
		changed$: new Subject<void>()
	};

	const email$ = new BehaviorSubject<boolean>(false);

	function render() {
		TestBed.configureTestingModule({
			imports: [InboxPageComponent],
			providers: [
				{ provide: InboxEmailAvailabilityService, useValue: { available$: email$ } },
				{ provide: InboxUiService, useValue: api },
				{ provide: InboxNotificationsService, useValue: { list: jest.fn(() => of({ items: [], total: 0 })) } },
				{ provide: Store, useValue: { user$: of(null), selectedOrganization$: of(null) } }
			]
		});
		const fixture = TestBed.createComponent(InboxPageComponent);
		fixture.detectChanges();
		const el: HTMLElement = fixture.nativeElement;
		return {
			fixture,
			component: fixture.componentInstance,
			find: (test: string) => el.querySelector(`[data-test="${test}"]`)
		};
	}

	beforeEach(() => jest.resetAllMocks());

	it('the API does not serve the Inbox (404): the notice only, no tab, no list request', () => {
		api.counts.mockReturnValue(throwError(() => ({ status: 404 })));
		const { component, find } = render();
		expect(component.view()).toBe('unavailable');
		expect(find('unavailable')).not.toBeNull();
		expect(find('tab-notifications')).toBeNull();
		expect(api.list).not.toHaveBeenCalled();
	});

	it('served: lists the first page of the tab', () => {
		api.counts.mockReturnValue(of({ unread: 1, decisionsOpen: 1, byMailbox: [] }));
		api.list.mockReturnValue(of({ items: [item('a')], nextCursor: null }));
		const { component, find } = render();
		expect(component.view()).toBe('ready');
		expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ tab: InboxTabEnum.ALL, limit: 20 }));
		expect(find('item-a')).not.toBeNull();
		expect(find('tab-snoozed')).not.toBeNull();
	});

	it('an item that leaves the list while more pages exist starts the list over (offset paging)', () => {
		api.counts.mockReturnValue(of({ unread: 2, decisionsOpen: 2, byMailbox: [] }));
		api.list.mockReturnValue(of({ items: [item('a'), item('b')], nextCursor: 'next' }));
		const { component } = render();
		api.setState.mockReturnValue(
			of(item('a', { recipient: { isRead: true, isArchived: true, snoozedUntil: null } }))
		);

		component.changeState(component.items()[0], { isArchived: true });

		expect(component.items().map((entry) => entry.id)).toEqual(['a', 'b']); // the reload's page
		expect(api.list).toHaveBeenCalledTimes(2);
		expect(api.list.mock.calls[1][0].cursor).toBeUndefined();
		expect(api.notifyChanged).toHaveBeenCalled();
	});

	it('with "unread only", an item I read leaves the list', () => {
		api.counts.mockReturnValue(of({ unread: 1, decisionsOpen: 1, byMailbox: [] }));
		api.list.mockReturnValue(of({ items: [item('a')], nextCursor: null }));
		const { component } = render();
		component.setUnread(true);
		api.setState.mockReturnValue(
			of(item('a', { recipient: { isRead: true, isArchived: false, snoozedUntil: null } }))
		);
		component.open(component.items()[0]);
		expect(component.items()).toEqual([]);
		// It stays open while I read it.
		expect(component.selected()).toMatchObject({ id: 'a', recipient: { isRead: true } });
	});

	it('an item marked done leaves the open tabs; brought back, it leaves the Done tab', () => {
		api.counts.mockReturnValue(of({ unread: 1, decisionsOpen: 1, byMailbox: [] }));
		api.list.mockReturnValue(of({ items: [item('a', { recipient: { isRead: true, isArchived: false, snoozedUntil: null } })], nextCursor: null }));
		const { component, find } = render();
		expect(find('tab-done')).not.toBeNull();
		// The item is open (read already: opening it changes nothing) when it is marked done, so the pane must close.
		component.open(component.items()[0]);
		expect(component.selected()).toMatchObject({ id: 'a' });
		api.setState.mockReturnValue(
			of(item('a', { recipient: { isRead: true, isArchived: false, snoozedUntil: null, isDone: true } }))
		);
		component.changeState(component.items()[0], { isDone: true });
		expect(api.setState).toHaveBeenCalledWith('a', { isDone: true });
		expect(component.items()).toEqual([]);
		expect(component.selected()).toBeNull();

		api.list.mockReturnValue(
			of({ items: [item('a', { recipient: { isRead: true, isArchived: false, snoozedUntil: null, isDone: true } })], nextCursor: null })
		);
		component.selectTab('done');
		expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ tab: InboxTabEnum.DONE }));
		expect(component.items().map((entry) => entry.id)).toEqual(['a']);
		api.setState.mockReturnValue(of(item('a', { recipient: { isRead: true, isArchived: false, snoozedUntil: null, isDone: false } })));
		component.changeState(component.items()[0], { isDone: false });
		expect(component.items()).toEqual([]);
	});

	it('keeps an item listed where the API keeps it: archived and marked done stays in Archived, done and snoozed stays in Done', () => {
		api.counts.mockReturnValue(of({ unread: 1, decisionsOpen: 1, byMailbox: [] }));
		const archived = item('a', { recipient: { isRead: true, isArchived: true, snoozedUntil: null } });
		api.list.mockReturnValue(of({ items: [archived], nextCursor: null }));
		const { component } = render();
		component.selectTab('archived');
		api.setState.mockReturnValue(of(item('a', { recipient: { isRead: true, isArchived: true, snoozedUntil: null, isDone: true } })));
		component.changeState(component.items()[0], { isDone: true });
		expect(component.items().map((entry) => entry.id)).toEqual(['a']);

		const done = item('b', { recipient: { isRead: true, isArchived: false, snoozedUntil: null, isDone: true } });
		api.list.mockReturnValue(of({ items: [done], nextCursor: null }));
		component.selectTab('done');
		const later = new Date(Date.now() + 3_600_000);
		api.setState.mockReturnValue(of(item('b', { recipient: { isRead: true, isArchived: false, snoozedUntil: later, isDone: true } })));
		component.changeState(component.items()[0], { snoozedUntil: later.toISOString() });
		expect(component.items().map((entry) => entry.id)).toEqual(['b']);
	});

	it('shows my counts beside the tabs, and reads them again after a change', () => {
		// Two unread emails: one of a mailbox, one mirrored from a source (no mailbox) — the Email tab counts both.
		api.counts.mockReturnValue(of({ unread: 3, decisionsOpen: 2, emailUnread: 2, byMailbox: [{ mailboxId: 'm', unread: 1 }] }));
		api.list.mockReturnValue(of({ items: [], nextCursor: null }));
		const { component, find, fixture } = render();
		expect(find('count-all')?.textContent?.trim()).toBe('3');
		expect(find('count-decisions')?.textContent?.trim()).toBe('2');
		expect(find('count-email')?.textContent?.trim()).toBe('2');
		expect(find('count-snoozed')).toBeNull();
		expect(find('count-done')).toBeNull();

		api.counts.mockReturnValue(of({ unread: 0, decisionsOpen: 2, emailUnread: 0, byMailbox: [] }));
		api.changed$.next();
		fixture.detectChanges();
		expect(find('count-all')).toBeNull();
		expect(component.tabCount('decisions')).toBe(2);
		expect(component.tabCount('email')).toBeNull();
	});

	it('a failed state change is shown', () => {
		api.counts.mockReturnValue(of({ unread: 1, decisionsOpen: 1, byMailbox: [] }));
		api.list.mockReturnValue(of({ items: [item('a')], nextCursor: null }));
		const { component } = render();
		api.setState.mockReturnValue(throwError(() => ({ status: 500, error: { message: 'Database is locked' } })));
		component.changeState(component.items()[0], { isArchived: true });
		expect(component.actionError()).toBe('Database is locked');
		expect(component.busy()).toBe(false);
	});

	it("'Mark all read' marks only what the filters show (review F65)", () => {
		api.counts.mockReturnValue(of({ unread: 2, decisionsOpen: 1, byMailbox: [] }));
		api.list.mockReturnValue(of({ items: [item('a')], nextCursor: null }));
		api.markAllRead.mockReturnValue(of({ updated: 1 }));
		const { component } = render();
		component.setKind(InboxItemKindEnum.NOTICE);
		component.setSource('EMAIL');
		component.query.set('  invoice ');
		component.markAllRead();
		expect(api.markAllRead).toHaveBeenCalledWith(InboxTabEnum.ALL, {
			kind: InboxItemKindEnum.NOTICE,
			source: 'EMAIL',
			q: '  invoice '
		});
	});

	it('an answered decision leaves the Decisions tab and stays open (review F66)', () => {
		api.counts.mockReturnValue(of({ unread: 2, decisionsOpen: 2, byMailbox: [] }));
		api.list.mockReturnValue(of({ items: [item('a'), item('b')], nextCursor: 'next' }));
		const { component } = render();
		component.selectTab('decisions');
		api.setState.mockReturnValue(
			of(item('a', { recipient: { isRead: true, isArchived: false, snoozedUntil: null } }))
		);
		component.open(component.items()[0]);
		const calls = api.list.mock.calls.length;
		api.reply.mockReturnValue(of(item('a', { status: InboxItemStatusEnum.ANSWERED })));
		component.reply(component.items()[0], { optionId: 'yes' });
		expect(component.items().map((entry) => entry.id)).toEqual(['b']);
		expect(component.selected()).toMatchObject({ id: 'a', status: InboxItemStatusEnum.ANSWERED });
		// The API pages after the last item shown, so nothing is skipped: no reload needed.
		expect(api.list.mock.calls.length).toBe(calls);
	});

	it("a reply's busy state and error belong to its item (review F67)", () => {
		api.counts.mockReturnValue(of({ unread: 2, decisionsOpen: 2, byMailbox: [] }));
		api.list.mockReturnValue(
			of({
				items: [item('a', { recipient: { isRead: true, isArchived: false, snoozedUntil: null } }), item('b')],
				nextCursor: null
			})
		);
		const { component, fixture } = render();
		const first = component.items()[0] as IInboxItemWithState;
		const second = component.items()[1] as IInboxItemWithState;
		const answer = new Subject<IInboxItemWithState>();
		api.reply.mockReturnValue(answer);
		component.open(first);
		component.reply(first, { text: 'Ship it' });
		expect(component.isReplying(first)).toBe(true);
		// Another item is opened (and read) while the reply is on its way: its state change ends, the reply does not.
		api.setState.mockReturnValue(
			of(item('b', { recipient: { isRead: true, isArchived: false, snoozedUntil: null } }))
		);
		component.open(second);
		expect(component.busy()).toBe(false);
		expect(component.isReplying(first)).toBe(true);
		// Back on the first: its Send stays disabled, and a second click sends nothing.
		component.open(first);
		component.reply(first, { text: 'Ship it' });
		expect(api.reply).toHaveBeenCalledTimes(1);
		// The reply fails while the other item is open: the error waits on its own item.
		component.open(second);
		answer.error({ status: 502, error: { message: 'The source did not take the reply.' } });
		fixture.detectChanges();
		expect(component.replyError()).toBeNull();
		component.open(first);
		expect(component.replyError()).toBe('The source did not take the reply.');
		expect(component.isReplying(first)).toBe(false);
	});

	it("'Mark all read' stays available while older pages are not loaded yet (review F69)", () => {
		api.counts.mockReturnValue(of({ unread: 3, decisionsOpen: 0, byMailbox: [] }));
		api.list.mockReturnValue(
			of({
				items: [item('a', { recipient: { isRead: true, isArchived: false, snoozedUntil: null } })],
				nextCursor: 'next'
			})
		);
		const { component } = render();
		expect(component.hasUnread()).toBe(true);
		api.list.mockReturnValue(
			of({
				items: [item('a', { recipient: { isRead: true, isArchived: false, snoozedUntil: null } })],
				nextCursor: null
			})
		);
		component.reload();
		expect(component.hasUnread()).toBe(false);
	});

	it("once 'Mark all read' went through, older pages count as read until the list changes (#11098 review)", () => {
		const read = { recipient: { isRead: true, isArchived: false, snoozedUntil: null } };
		api.counts.mockReturnValue(of({ unread: 3, decisionsOpen: 0, byMailbox: [] }));
		api.list.mockReturnValue(of({ items: [item('a', read)], nextCursor: 'next' }));
		api.markAllRead.mockReturnValue(of({ updated: 3 }));
		const { component } = render();
		expect(component.hasUnread()).toBe(true);
		component.markAllRead();
		expect(component.hasUnread()).toBe(false);
		component.setKind(InboxItemKindEnum.NOTICE);
		expect(component.hasUnread()).toBe(true);
	});

	it('a mark-all answered after the filters changed says nothing about the new list (#11098 review)', () => {
		const read = { recipient: { isRead: true, isArchived: false, snoozedUntil: null } };
		api.counts.mockReturnValue(of({ unread: 3, decisionsOpen: 0, byMailbox: [] }));
		api.list.mockReturnValue(of({ items: [item('a', read)], nextCursor: 'next' }));
		const answer = new Subject<{ updated: number }>();
		api.markAllRead.mockReturnValue(answer);
		const { component } = render();
		component.markAllRead();
		component.setKind(InboxItemKindEnum.NOTICE);
		answer.next({ updated: 1 });
		// The notices' older pages were not marked: the button stays.
		expect(component.hasUnread()).toBe(true);
	});

	it('a decision answered elsewhere first (409) leaves the Decisions tab too (#11098 review)', () => {
		api.counts.mockReturnValue(of({ unread: 0, decisionsOpen: 2, byMailbox: [] }));
		const read = { recipient: { isRead: true, isArchived: false, snoozedUntil: null } };
		api.list.mockReturnValue(of({ items: [item('a', read), item('b', read)], nextCursor: null }));
		const { component } = render();
		component.selectTab('decisions');
		component.open(component.items()[0]);
		api.reply.mockReturnValue(
			throwError(() => ({ status: 409, error: { message: 'This item was already answered.' } }))
		);
		api.get.mockReturnValue(of(item('a', { ...read, status: InboxItemStatusEnum.ANSWERED })));
		component.reply(component.items()[0], { optionId: 'yes' });
		expect(component.items().map((entry) => entry.id)).toEqual(['b']);
		expect(component.selected()).toMatchObject({ id: 'a', status: InboxItemStatusEnum.ANSWERED });
		expect(component.replyError()).toBe('This item was already answered.');
	});

	it('reads the message of an API refusal', () => {
		expect(apiMessage({ error: { message: 'Already decided in Ever Works' } })).toBe(
			'Already decided in Ever Works'
		);
		expect(apiMessage({ error: { message: ['a', 'b'] } })).toBe('a b');
		expect(apiMessage(null)).toBeNull();
	});

	it('links "My mailbox" only where the API serves the email features', () => {
		api.counts.mockReturnValue(of({ unread: 0, decisionsOpen: 0, byMailbox: [] }));
		api.list.mockReturnValue(of({ items: [], nextCursor: null }));
		email$.next(false);
		const { find, fixture } = render();
		expect(find('my-mailbox')).toBeNull();
		email$.next(true);
		fixture.detectChanges();
		expect(find('my-mailbox')?.getAttribute('href')).toBe('/pages/inbox/mailbox');
	});

	describe('the deep link ?item=<id> (an Ever Works copy links back here)', () => {
		function withItemLink(id: string) {
			email$.next(false);
			const params$ = new BehaviorSubject(convertToParamMap({ item: id }));
			TestBed.configureTestingModule({
				providers: [
					{
						provide: ActivatedRoute,
						useValue: { snapshot: { queryParamMap: params$.value }, queryParamMap: params$ }
					}
				]
			});
			return params$;
		}

		it('opens a later ?item= too (the router reuses the page for another link)', () => {
			api.counts.mockReturnValue(of({ unread: 2, decisionsOpen: 0, byMailbox: [] }));
			api.list.mockReturnValue(of({ items: [item('a')], nextCursor: null }));
			api.get.mockImplementation((id: string) => of(item(id)));
			api.setState.mockImplementation((id: string) =>
				of(item(id, { recipient: { isRead: true, isArchived: false, snoozedUntil: null } }))
			);
			const params$ = withItemLink('first');
			const { component, fixture } = render();
			fixture.detectChanges();
			expect(component.selected()).toMatchObject({ id: 'first' });
			params$.next(convertToParamMap({ item: ' second ' }));
			fixture.detectChanges();
			expect(api.get).toHaveBeenLastCalledWith('second');
			expect(component.selected()).toMatchObject({ id: 'second' });
		});

		it('never opens (marks read) an item whose detail cannot be shown: the list failed, or Notifications is chosen', () => {
			api.counts.mockReturnValue(of({ unread: 1, decisionsOpen: 0, byMailbox: [] }));
			const fetched = new Subject<IInboxItemWithState>();
			api.get.mockReturnValue(fetched);
			api.list.mockReturnValue(throwError(() => ({ status: 500 })));
			const params$ = withItemLink('deep');
			const { component, fixture } = render();
			fixture.detectChanges();
			expect(component.view()).toBe('error');
			fetched.next(item('deep'));
			expect(component.selected()).toBeNull();
			expect(api.setState).not.toHaveBeenCalled();
			// The retry serves the list, and opens the link then.
			api.list.mockReturnValue(of({ items: [item('a')], nextCursor: null }));
			api.get.mockReturnValue(of(item('deep')));
			api.setState.mockReturnValue(of(item('deep')));
			component.reload();
			fixture.detectChanges();
			expect(component.selected()).toMatchObject({ id: 'deep' });

			// Another link followed, then Notifications chosen before its fetch answers: nothing opens.
			api.setState.mockClear();
			const later = new Subject<IInboxItemWithState>();
			api.get.mockReturnValue(later);
			params$.next(convertToParamMap({ item: 'other' }));
			expect(api.get).toHaveBeenLastCalledWith('other');
			component.tab.set('notifications');
			later.next(item('other'));
			expect(component.selected()).toMatchObject({ id: 'deep' });
			expect(api.setState).not.toHaveBeenCalled();
		});

		it('says when the linked item could not be read (not a 404), and opens nothing', () => {
			api.counts.mockReturnValue(of({ unread: 0, decisionsOpen: 0, byMailbox: [] }));
			api.list.mockReturnValue(of({ items: [item('a')], nextCursor: null }));
			api.get.mockReturnValue(throwError(() => ({ status: 503 })));
			const params$ = withItemLink('deep');
			const { component, fixture, find } = render();
			fixture.detectChanges();
			expect(component.view()).toBe('ready');
			expect(component.actionError()).toBe('INBOX.ITEM_LINK_ERROR');
			expect(find('action-error')).not.toBeNull();
			expect(component.selected()).toBeNull();
			// A link that opens clears the alert.
			api.get.mockReturnValue(of(item('other')));
			api.setState.mockReturnValue(of(item('other')));
			params$.next(convertToParamMap({ item: 'other' }));
			expect(component.selected()).toMatchObject({ id: 'other' });
			expect(component.actionError()).toBeNull();
		});

		it('only the latest link counts: a link followed while an earlier one is read cancels that read', () => {
			api.counts.mockReturnValue(of({ unread: 2, decisionsOpen: 0, byMailbox: [] }));
			api.list.mockReturnValue(of({ items: [item('a')], nextCursor: null }));
			const first = new Subject<IInboxItemWithState>();
			const second = new Subject<IInboxItemWithState>();
			api.get.mockImplementation((id: string) => (id === 'first' ? first : second));
			api.setState.mockImplementation((id: string) => of(item(id)));
			const params$ = withItemLink('first');
			const { component, fixture } = render();
			fixture.detectChanges();
			params$.next(convertToParamMap({ item: 'second' }));
			first.next(item('first'));
			expect(component.selected()).toBeNull();
			second.next(item('second'));
			expect(component.selected()).toMatchObject({ id: 'second' });
			expect(api.setState).toHaveBeenCalledTimes(1);
			expect(api.setState).toHaveBeenCalledWith('second', { isRead: true });
		});

		it('opens that item once the Inbox is served, as a click on its row does, though no tab lists it', () => {
			api.counts.mockReturnValue(of({ unread: 1, decisionsOpen: 0, byMailbox: [] }));
			api.list.mockReturnValue(of({ items: [item('a')], nextCursor: null }));
			api.get.mockReturnValue(of(item('deep')));
			api.setState.mockReturnValue(
				of(item('deep', { recipient: { isRead: true, isArchived: false, snoozedUntil: null } }))
			);
			withItemLink('deep');
			const { component, fixture, find } = render();
			fixture.detectChanges();
			expect(api.get).toHaveBeenCalledWith('deep');
			expect(component.selected()).toMatchObject({ id: 'deep', recipient: { isRead: true } });
			// Opened like a row: an unread item becomes read.
			expect(api.setState).toHaveBeenCalledWith('deep', { isRead: true });
			expect(find('no-selection')).toBeNull();
		});

		it('reads the linked item once the list is served, so the list never lands over it', () => {
			const read = { isRead: true, isArchived: false, snoozedUntil: null };
			const list = new Subject<{ items: IInboxItemWithState[]; nextCursor: string | null }>();
			api.counts.mockReturnValue(of({ unread: 0, decisionsOpen: 0, byMailbox: [] }));
			api.list.mockReturnValue(list);
			api.get.mockReturnValue(of(item('a', { title: 'New title', recipient: read })));
			withItemLink('a');
			const { component, fixture } = render();
			fixture.detectChanges();
			expect(api.get).not.toHaveBeenCalled();
			list.next({ items: [item('a', { title: 'Old title', recipient: read })], nextCursor: null });
			expect(api.get).toHaveBeenCalledWith('a');
			expect(component.selected()).toMatchObject({ id: 'a', title: 'New title' });
		});

		it('a link that waited for the list never replaces an item opened meanwhile, nor alerts when its read fails then', () => {
			const read = { isRead: true, isArchived: false, snoozedUntil: null };
			api.counts.mockReturnValue(of({ unread: 0, decisionsOpen: 0, byMailbox: [] }));
			api.list.mockReturnValue(of({ items: [item('a', { recipient: read })], nextCursor: null }));
			api.get.mockReturnValue(of(item('x', { recipient: read })));
			const params$ = withItemLink('x');
			const { component, fixture } = render();
			fixture.detectChanges();
			expect(component.selected()).toMatchObject({ id: 'x' });
			// A list reload is on its way when another link arrives; the user opens a row before the list answers.
			const list = new Subject<{ items: IInboxItemWithState[]; nextCursor: string | null }>();
			api.list.mockReturnValue(list);
			component.reload();
			params$.next(convertToParamMap({ item: 'deep' }));
			component.open(item('a', { recipient: read }));
			api.get.mockReturnValue(of(item('deep', { recipient: read })));
			list.next({ items: [item('a', { recipient: read })], nextCursor: null });
			expect(component.selected()).toMatchObject({ id: 'a' });
			// The same with a read that fails: no alert, and nothing kept for the next list.
			const failing = new Subject<IInboxItemWithState>();
			api.get.mockReturnValue(failing);
			api.list.mockReturnValue(of({ items: [item('a', { recipient: read })], nextCursor: null }));
			params$.next(convertToParamMap({ item: 'other' }));
			component.open(item('b', { recipient: read }));
			failing.error({ status: 503 });
			expect(component.actionError()).toBeNull();
			api.get.mockClear();
			component.reload();
			expect(api.get).not.toHaveBeenCalled();
			expect(component.selected()).toMatchObject({ id: 'b' });
		});

		it('a link followed while more items load opens once that page is served', () => {
			api.counts.mockReturnValue(of({ unread: 0, decisionsOpen: 0, byMailbox: [] }));
			api.list.mockReturnValue(of({ items: [item('a')], nextCursor: 'c1' }));
			api.get.mockReturnValue(
				of(item('deep', { recipient: { isRead: true, isArchived: false, snoozedUntil: null } }))
			);
			const params$ = withItemLink('');
			const { component, fixture } = render();
			fixture.detectChanges();
			const page = new Subject<{ items: IInboxItemWithState[]; nextCursor: string | null }>();
			api.list.mockReturnValue(page);
			component.more();
			params$.next(convertToParamMap({ item: 'deep' }));
			expect(api.get).not.toHaveBeenCalled();
			page.next({ items: [item('b')], nextCursor: null });
			expect(api.get).toHaveBeenCalledWith('deep');
			expect(component.selected()).toMatchObject({ id: 'deep' });
		});

		it('a link removed (another tab chosen) while it is read opens nothing', () => {
			api.counts.mockReturnValue(of({ unread: 1, decisionsOpen: 0, byMailbox: [] }));
			api.list.mockReturnValue(of({ items: [item('a')], nextCursor: null }));
			const fetched = new Subject<IInboxItemWithState>();
			api.get.mockReturnValue(fetched);
			const params$ = withItemLink('deep');
			const { component, fixture } = render();
			fixture.detectChanges();
			expect(api.get).toHaveBeenCalledWith('deep');
			params$.next(convertToParamMap({ tab: 'decisions' }));
			fetched.next(item('deep'));
			expect(component.selected()).toBeNull();
			expect(api.setState).not.toHaveBeenCalled();
		});

		it('shows the linked item as just read, not an older copy the list holds', () => {
			const read = { isRead: true, isArchived: false, snoozedUntil: null };
			api.counts.mockReturnValue(of({ unread: 0, decisionsOpen: 0, byMailbox: [] }));
			api.list.mockReturnValue(
				of({ items: [item('a', { title: 'Old title', recipient: read })], nextCursor: null })
			);
			api.get.mockReturnValue(of(item('a', { title: 'New title', recipient: read })));
			withItemLink('a');
			const { component, fixture } = render();
			fixture.detectChanges();
			expect(component.selected()).toMatchObject({ id: 'a', title: 'New title' });
			expect(api.setState).not.toHaveBeenCalled();
		});

		it('an id the API does not show me (404) is ignored quietly', () => {
			api.counts.mockReturnValue(of({ unread: 0, decisionsOpen: 0, byMailbox: [] }));
			api.list.mockReturnValue(of({ items: [item('a')], nextCursor: null }));
			api.get.mockReturnValue(throwError(() => ({ status: 404, error: { message: 'Not Found' } })));
			withItemLink('not-mine');
			const { component, fixture, find } = render();
			fixture.detectChanges();
			expect(component.view()).toBe('ready');
			expect(component.selected()).toBeNull();
			expect(component.actionError()).toBeNull();
			expect(find('item-a')).not.toBeNull();
			expect(find('no-selection')).not.toBeNull();
		});

		it('is not asked for where the API does not serve the Inbox', () => {
			api.counts.mockReturnValue(throwError(() => ({ status: 404 })));
			withItemLink('deep');
			expect(render().component.view()).toBe('unavailable');
			expect(api.get).not.toHaveBeenCalled();
		});
	});

	describe('bulk actions, undo, shortcuts and empty states', () => {
		const read = (id: string, extra: Partial<IInboxItemWithState['recipient'] & object> = {}) =>
			item(id, { recipient: { isRead: true, isArchived: false, snoozedUntil: null, ...extra } });

		function ready(items: IInboxItemWithState[]) {
			api.counts.mockReturnValue(of({ unread: 0, decisionsOpen: 0, byMailbox: [] }));
			api.list.mockReturnValue(of({ items, nextCursor: null }));
			return render();
		}

		const press = (key: string, target: EventTarget = document.body) => {
			const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
			target.dispatchEvent(event);
			return event;
		};

		it('archives the checked rows, one request each, and offers to undo it', () => {
			const { component, fixture, find } = ready([read('a'), read('b'), read('c')]);
			component.toggleChecked(component.items()[0]);
			component.toggleChecked(component.items()[1]);
			fixture.detectChanges();
			expect(find('bulk-bar')).not.toBeNull();
			expect(find('filters')).toBeNull();
			api.setState.mockImplementation((id: string) => of(read(id, { isArchived: true })));

			component.bulk({ isArchived: true });

			expect(api.setState).toHaveBeenCalledTimes(2);
			expect(api.setState).toHaveBeenCalledWith('a', { isArchived: true });
			expect(component.items().map((entry) => entry.id)).toEqual(['c']);
			expect(component.checkedCount()).toBe(0);
			expect(component.undo()).toEqual({
				kind: 'ARCHIVED',
				entries: [
					{ id: 'a', revert: { isArchived: false } },
					{ id: 'b', revert: { isArchived: false } }
				]
			});
			expect(api.notifyChanged).toHaveBeenCalled();
		});

		it('keeps a row that failed checked, and says so', () => {
			const { component } = ready([read('a'), read('b')]);
			component.toggleAll();
			expect(component.allChecked()).toBe(true);
			api.setState.mockImplementation((id: string) =>
				id === 'a' ? of(read('a', { isDone: true })) : throwError(() => ({ status: 500 }))
			);

			component.bulk({ isDone: true });

			expect(component.items().map((entry) => entry.id)).toEqual(['b']);
			expect([...component.checked()]).toEqual(['b']);
			expect(component.actionError()).toBe('INBOX.BULK.FAILED');
		});

		it('lists rows as list items: the title is the native button that opens one, the checkbox a control beside it', () => {
			const { component, find } = ready([read('a')]);
			const row = find('item-a') as HTMLElement;
			expect(row.getAttribute('role')).toBe('listitem');
			expect(row.parentElement?.getAttribute('role')).toBe('list');
			expect(row.querySelector('[role="button"]')).toBeNull();
			const open = find('open-a') as HTMLButtonElement;
			expect(open.tagName).toBe('BUTTON');
			expect(open.contains(find('check-a'))).toBe(false);

			open.click();
			expect(component.selectedId()).toBe('a');
			(find('check-a') as HTMLButtonElement).click();
			expect(component.isChecked(component.items()[0])).toBe(true);
		});

		it('a bulk answer that comes after another tab was chosen leaves that tab and its selection alone', () => {
			const { component } = ready([read('a'), read('b')]);
			component.toggleAll();
			const answer = new Subject<IInboxItemWithState>();
			api.setState.mockReturnValue(answer);
			component.bulk({ isDone: true });

			api.list.mockReturnValue(of({ items: [read('c')], nextCursor: null }));
			component.selectTab('archived');
			expect(component.checkedCount()).toBe(0);
			answer.error({ status: 500 });

			expect(component.checkedCount()).toBe(0);
			expect(component.items().map((entry) => entry.id)).toEqual(['c']);
		});

		it('the shortcuts sheet takes focus when it opens, keeps Tab inside, and gives focus back when it closes', () => {
			const { fixture, find } = ready([read('a')]);
			const opener = find('shortcuts') as HTMLButtonElement;
			opener.focus();
			opener.click();
			fixture.detectChanges();
			TestBed.inject(ApplicationRef).tick();
			const close = find('shortcuts-close') as HTMLButtonElement;
			expect(document.activeElement).toBe(close);

			const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
			close.dispatchEvent(tab);
			expect(tab.defaultPrevented).toBe(true);
			expect(document.activeElement).toBe(close);

			press('Escape');
			fixture.detectChanges();
			expect(find('shortcuts-sheet')).toBeNull();
			expect(document.activeElement).toBe(opener);
		});

		it('"Undo" takes the change back and reads the list again', () => {
			const { component } = ready([read('a')]);
			api.setState.mockReturnValueOnce(of(read('a', { isArchived: true })));
			component.changeState(component.items()[0], { isArchived: true });
			expect(component.undo()?.kind).toBe('ARCHIVED');
			api.setState.mockReturnValueOnce(of(read('a')));

			component.undoLast();

			expect(api.setState).toHaveBeenLastCalledWith('a', { isArchived: false });
			expect(component.undo()).toBeNull();
			expect(component.items().map((entry) => entry.id)).toEqual(['a']);
			expect(api.list).toHaveBeenCalledTimes(2);
		});

		it('j / k open the next and the previous row; e archives the open one', () => {
			const { component } = ready([read('a'), read('b')]);
			press('j');
			expect(component.selectedId()).toBe('a');
			press('j');
			expect(component.selectedId()).toBe('b');
			press('k');
			expect(component.selectedId()).toBe('a');

			api.setState.mockReturnValue(of(read('a', { isArchived: true })));
			press('e');
			expect(api.setState).toHaveBeenCalledWith('a', { isArchived: true });
		});

		it('takes no shortcut typed in a field, nor with Ctrl; "?" opens the sheet and Esc closes it', () => {
			const { component, fixture, find } = ready([read('a')]);
			const field = document.createElement('input');
			document.body.appendChild(field);
			press('j', field);
			expect(component.selectedId()).toBeNull();
			document.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', ctrlKey: true }));
			expect(component.selectedId()).toBeNull();
			field.remove();

			press('?');
			fixture.detectChanges();
			expect(find('shortcuts-sheet')).not.toBeNull();
			press('j');
			expect(component.selectedId()).toBeNull();
			press('Escape');
			fixture.detectChanges();
			expect(find('shortcuts-sheet')).toBeNull();
		});

		it("says what each tab holds when it is empty, and offers to clear the filters when they hide everything", () => {
			const { component, fixture, find } = ready([]);
			expect(find('empty')?.textContent).toContain('INBOX.EMPTY_TAB.all.TITLE');
			component.setUnread(true);
			fixture.detectChanges();
			expect(find('empty')?.textContent).toContain('INBOX.EMPTY_FILTERED.TITLE');

			(find('clear-filters') as HTMLButtonElement).click();
			expect(component.unreadOnly()).toBe(false);
			expect(api.list).toHaveBeenLastCalledWith(expect.not.objectContaining({ unread: true }));
		});

		it('shows a due label on an open item that has a due date', () => {
			const { find } = ready([read('a', {}), item('b', { dueAt: new Date(Date.now() - 60_000) as never })]);
			expect(find('due-a')).toBeNull();
			expect(find('due-b')?.getAttribute('data-due')).toBe('OVERDUE');
		});

		it('a click on a row\'s time or due label opens the row, as a click anywhere else on it does', () => {
			api.setState.mockImplementation((id: string) => of(read(id)));
			const { component, find } = ready([read('a'), item('b', { dueAt: new Date(Date.now() - 60_000) as never })]);
			(find('when-a') as HTMLElement).click();
			expect(component.selectedId()).toBe('a');
			(find('due-b') as HTMLElement).click();
			expect(component.selectedId()).toBe('b');
		});
	});
});
