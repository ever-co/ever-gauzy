import { discardPeriodicTasks, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { InboxTabEnum } from '@gauzy/contracts';
import { INBOX_BADGE_POLL_MS } from '../../inbox-ui.constants';
import { InboxUiService } from '../../services/inbox-ui.service';
import { badgeText, INBOX_HEADER_MENU_SIZE, InboxHeaderBadgeComponent } from './inbox-header-badge.component';

/** The header badge: my unread count, read every 60 s and at once after a change on the page. */
describe('InboxHeaderBadgeComponent', () => {
	const changed$ = new Subject<void>();
	const api = { counts: jest.fn(), list: jest.fn(), changed$ };

	function render() {
		TestBed.configureTestingModule({
			imports: [InboxHeaderBadgeComponent],
			providers: [{ provide: InboxUiService, useValue: api }]
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
});
