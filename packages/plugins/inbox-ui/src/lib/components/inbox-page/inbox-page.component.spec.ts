import { TestBed } from '@angular/core/testing';
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
});
