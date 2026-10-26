import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { InboxTabEnum } from '@gauzy/contracts';
import { InboxNotificationsService, InboxUiService } from './inbox-ui.service';

/** The routes the page and the badge call (the root test defaults provide the testing HttpClient). */
describe('Inbox UI services', () => {
	let http: HttpTestingController;
	let inbox: InboxUiService;
	let notifications: InboxNotificationsService;

	beforeEach(() => {
		http = TestBed.inject(HttpTestingController);
		inbox = TestBed.inject(InboxUiService);
		notifications = TestBed.inject(InboxNotificationsService);
	});

	afterEach(() => http.verify());

	it('lists my items with only the stated filters', () => {
		inbox.list({ tab: InboxTabEnum.DECISIONS, unread: true, q: 'vendor', kind: undefined, limit: 20 }).subscribe();
		const request = http.expectOne((req) => req.url === '/api/inbox/items');
		expect(request.request.method).toBe('GET');
		expect(request.request.params.keys().sort()).toEqual(['limit', 'q', 'tab', 'unread']);
		expect(request.request.params.get('tab')).toBe('decisions');
		request.flush({ items: [], nextCursor: null });
	});

	it('reads the counts, replies, changes my state and marks all read', () => {
		inbox.counts().subscribe();
		http.expectOne('/api/inbox/items/counts').flush({ unread: 0, decisionsOpen: 0, byMailbox: [] });

		inbox.reply('item-1', { optionId: 'yes' }).subscribe();
		const reply = http.expectOne('/api/inbox/items/item-1/reply');
		expect(reply.request.method).toBe('POST');
		expect(reply.request.body).toEqual({ optionId: 'yes' });
		reply.flush({});

		inbox.setState('item-1', { isArchived: true }).subscribe();
		const state = http.expectOne('/api/inbox/items/item-1/state');
		expect(state.request.method).toBe('PATCH');
		state.flush({});

		inbox.markAllRead(InboxTabEnum.ALL).subscribe();
		const all = http.expectOne('/api/inbox/items/mark-all-read');
		expect(all.request.body).toEqual({ tab: 'all' });
		all.flush({ updated: 0 });
	});

	it('reads the notifications of my own employee, newest first', () => {
		notifications
			.list({ tenantId: 'tenant', organizationId: 'org', receiverEmployeeId: 'employee', skip: 20 })
			.subscribe();
		const request = http.expectOne((req) => req.url === '/api/employee-notification');
		expect(request.request.params.get('where[receiverEmployeeId]')).toBe('employee');
		expect(request.request.params.get('where[tenantId]')).toBe('tenant');
		expect(request.request.params.get('where[organizationId]')).toBe('org');
		expect(request.request.params.get('order[createdAt]')).toBe('DESC');
		expect(request.request.params.get('skip')).toBe('20');
		request.flush({ items: [], total: 0 });

		notifications.markRead('n-1').subscribe();
		const read = http.expectOne('/api/employee-notification/n-1');
		expect(read.request.method).toBe('PUT');
		expect(read.request.body).toMatchObject({ isRead: true });
		read.flush({});
	});
});
