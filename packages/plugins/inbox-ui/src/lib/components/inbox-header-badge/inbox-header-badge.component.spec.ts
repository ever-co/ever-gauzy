// The ui-core barrel pulls the whole app shell (cookies, Sentry); the badge needs only the store.
jest.mock('@gauzy/ui-core/core', () => ({ Store: class Store {} }));

import { discardPeriodicTasks, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { BehaviorSubject, NEVER, of, Subject, throwError } from 'rxjs';
import { InboxTabEnum } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { INBOX_BADGE_POLL_MS } from '../../inbox-ui.constants';
import { InboxUiService } from '../../services/inbox-ui.service';
import { badgeText, INBOX_HEADER_MENU_SIZE, InboxHeaderBadgeComponent } from './inbox-header-badge.component';

/** The header badge: my unread count, read every 60 s and at once after a change on the page. */
describe('InboxHeaderBadgeComponent', () => {
	const changed$ = new Subject<void>();
	const api = { counts: jest.fn(), list: jest.fn(), requestItem: jest.fn(), changed$ };
	let user$: BehaviorSubject<{ id: string } | null>;
	let organization$: BehaviorSubject<{ id: string } | null>;

	function render() {
		user$ = new BehaviorSubject<{ id: string } | null>({ id: 'u1' });
		organization$ = new BehaviorSubject<{ id: string } | null>({ id: 'o1' });
		TestBed.configureTestingModule({
			imports: [InboxHeaderBadgeComponent],
			providers: [
				{ provide: InboxUiService, useValue: api },
				{ provide: Store, useValue: { user$, selectedOrganization$: organization$ } }
			]
		});
		const fixture = TestBed.createComponent(InboxHeaderBadgeComponent);
		fixture.detectChanges();
		return fixture;
	}

	beforeEach(() => jest.resetAllMocks());

	it('formats the count', () => {
		expect(badgeText(0)).toBe('');
		expect(badgeText(-1)).toBe('');
		expect(badgeText(7)).toBe('7');
		expect(badgeText(150)).toBe('99+');
	});

	it('reads the counts at once, every 60 s, and after a change', fakeAsync(() => {
		api.counts.mockReturnValue(of({ unread: 3, decisionsOpen: 1, byMailbox: [] }));
		const fixture = render();
		tick(0); // the first read is the poll timer's tick at 0 ms
		expect(api.counts).toHaveBeenCalledTimes(1);
		expect(fixture.componentInstance.text()).toBe('3');

		tick(INBOX_BADGE_POLL_MS);
		expect(api.counts).toHaveBeenCalledTimes(2);

		changed$.next();
		expect(api.counts).toHaveBeenCalledTimes(3);
		discardPeriodicTasks();
		fixture.destroy();
	}));

	it('stops when the API does not serve the Inbox (404)', fakeAsync(() => {
		api.counts.mockReturnValue(throwError(() => ({ status: 404 })));
		const fixture = render();
		tick(0);
		expect(api.counts).toHaveBeenCalledTimes(1);
		tick(INBOX_BADGE_POLL_MS * 3);
		expect(api.counts).toHaveBeenCalledTimes(1);
		expect(fixture.componentInstance.text()).toBe('');
		fixture.destroy();
	}));

	it('keeps polling after another failure', fakeAsync(() => {
		api.counts
			.mockReturnValueOnce(throwError(() => ({ status: 502 })))
			.mockReturnValue(of({ unread: 1, decisionsOpen: 0, byMailbox: [] }));
		const fixture = render();
		tick(INBOX_BADGE_POLL_MS);
		expect(api.counts).toHaveBeenCalledTimes(2);
		expect(fixture.componentInstance.text()).toBe('1');
		discardPeriodicTasks();
		fixture.destroy();
	}));

	it('reads my latest items when the dropdown opens', fakeAsync(() => {
		api.counts.mockReturnValue(of({ unread: 1, decisionsOpen: 0, byMailbox: [] }));
		const items = [{ id: 'i1', title: 'Approve the budget', kind: 'approval', recipient: { isRead: false } }];
		api.list.mockReturnValue(of({ items, nextCursor: null }));
		const fixture = render();
		tick(0);
		expect(api.list).not.toHaveBeenCalled();

		fixture.componentInstance.onShowChange(true);
		expect(api.list).toHaveBeenCalledWith({ tab: InboxTabEnum.ALL, limit: INBOX_HEADER_MENU_SIZE });
		expect(fixture.componentInstance.state()).toBe('ready');
		expect(fixture.componentInstance.items()).toEqual(items);
		expect(fixture.componentInstance.open()).toBe(true);

		fixture.componentInstance.onShowChange(false);
		expect(fixture.componentInstance.open()).toBe(false);
		expect(api.list).toHaveBeenCalledTimes(1);
		discardPeriodicTasks();
		fixture.destroy();
	}));

	it('says so when the dropdown items cannot be read', fakeAsync(() => {
		api.counts.mockReturnValue(of({ unread: 0, decisionsOpen: 0, byMailbox: [] }));
		api.list.mockReturnValue(throwError(() => ({ status: 502 })));
		const fixture = render();
		tick(0);
		fixture.componentInstance.onShowChange(true);
		expect(fixture.componentInstance.state()).toBe('error');
		discardPeriodicTasks();
		fixture.destroy();
	}));

	it('shows the items it has, not an earlier failure, while it reads them again', fakeAsync(() => {
		api.counts.mockReturnValue(of({ unread: 1, decisionsOpen: 0, byMailbox: [] }));
		const items = [{ id: 'i1', title: 'Approve the budget', kind: 'approval', recipient: { isRead: false } }];
		api.list.mockReturnValueOnce(of({ items, nextCursor: null })).mockReturnValueOnce(throwError(() => ({ status: 502 })));
		const fixture = render();
		tick(0);
		fixture.componentInstance.onShowChange(true);
		fixture.componentInstance.onShowChange(true);
		expect(fixture.componentInstance.state()).toBe('error');

		api.list.mockReturnValue(NEVER);
		fixture.componentInstance.onShowChange(true);
		expect(fixture.componentInstance.state()).toBe('ready');
		expect(fixture.componentInstance.items()).toEqual(items);
		discardPeriodicTasks();
		fixture.destroy();
	}));

	it('tells an Inbox page already shown which item was chosen, unless the link opens in another tab', fakeAsync(() => {
		api.counts.mockReturnValue(of({ unread: 0, decisionsOpen: 0, byMailbox: [] }));
		const fixture = render();
		tick(0);
		const badge = fixture.componentInstance as unknown as { choose(event: MouseEvent, id: string): void };
		badge.choose(new MouseEvent('click'), 'i1');
		expect(api.requestItem).toHaveBeenCalledWith('i1');

		for (const modifier of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey']) {
			badge.choose(new MouseEvent('click', { [modifier]: true }), 'i2');
		}
		expect(api.requestItem).toHaveBeenCalledTimes(1);
		discardPeriodicTasks();
		fixture.destroy();
	}));

	it('clears the items of the user or organization before and drops its late answer when either changes', fakeAsync(() => {
		api.counts.mockReturnValue(of({ unread: 0, decisionsOpen: 0, byMailbox: [] }));
		const first = [{ id: 'i1', title: 'Mine', kind: 'notice', recipient: { isRead: true } }];
		const next = [{ id: 'i2', title: 'Theirs', kind: 'notice', recipient: { isRead: true } }];
		api.list.mockReturnValueOnce(of({ items: first, nextCursor: null }));
		const fixture = render();
		tick(0);
		const badge = fixture.componentInstance;
		badge.onShowChange(true);
		expect(badge.items()).toEqual(first);
		badge.onShowChange(false);

		// Opened again: its read is still on the way when another user signs in.
		const late = new Subject<{ items: typeof first; nextCursor: null }>();
		api.list.mockReturnValueOnce(late).mockReturnValueOnce(of({ items: next, nextCursor: null }));
		badge.onShowChange(true);
		user$.next({ id: 'u2' });
		// The open dropdown reads the new user's items at once; the answer for the user before is never shown.
		expect(badge.items()).toEqual(next);
		late.next({ items: first, nextCursor: null });
		late.complete();
		expect(badge.items()).toEqual(next);

		// Closed during a change of organization: nothing of the one before is left for the next opening.
		badge.onShowChange(false);
		organization$.next({ id: 'o2' });
		expect(badge.items()).toEqual([]);
		expect(badge.state()).toBe('loading');
		discardPeriodicTasks();
		fixture.destroy();
	}));
});
