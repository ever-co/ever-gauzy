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
});
