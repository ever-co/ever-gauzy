import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { InboxDirectoryService, userName } from './inbox-directory.service';

/** The pickers' lists: users, employees, teams and the Ever Works agents. */
describe('InboxDirectoryService', () => {
	let http: HttpTestingController;
	let directory: InboxDirectoryService;

	beforeEach(() => {
		http = TestBed.inject(HttpTestingController);
		directory = TestBed.inject(InboxDirectoryService);
	});

	afterEach(() => http.verify());

	it('names a user by first and last name, else the email', () => {
		expect(userName({ firstName: 'Ada', lastName: 'Lovelace' })).toBe('Ada Lovelace');
		expect(userName({ email: 'ada@acme.test' })).toBe('ada@acme.test');
		expect(userName(null)).toBe('');
	});

	it('lists the active users of the organization, by name', () => {
		let names: string[] = [];
		directory.users('org-1', 'tenant-1').subscribe((users) => (names = users.map((user) => user.name)));
		const request = http.expectOne((req) => req.url === '/api/user-organization');
		expect(request.request.params.get('where[organizationId]')).toBe('org-1');
		expect(request.request.params.get('relations[0]')).toBe('user');
		request.flush({
			items: [
				{ userId: 'u2', isActive: true, user: { firstName: 'Zoe' } },
				{ userId: 'u1', isActive: true, user: { firstName: 'Ada' } },
				{ userId: 'u3', isActive: false, user: { firstName: 'Gone' } }
			],
			total: 3
		});
		expect(names).toEqual(['Ada', 'Zoe']);
	});

	it('lists only the agents whose profile comes from Ever Works', () => {
		let agents: Array<{ id: string; name: string }> = [];
		directory.everWorksAgents('org-1', 'tenant-1').subscribe((entries) => (agents = entries));
		const list = http.expectOne((req) => req.url === '/api/employee');
		expect(list.request.params.get('kind')).toBe('agent');
		list.flush({ items: [{ id: 'a1', user: { firstName: 'Reviewer' } }, { id: 'a2' }, { id: 'a3' }], total: 3 });
		http.expectOne('/api/employee/a1/agent-profile').flush({ source: 'ever_works', title: 'Code reviewer' });
		http.expectOne('/api/employee/a2/agent-profile').flush({ source: 'gauzy_ai' });
		http.expectOne('/api/employee/a3/agent-profile').flush({}, { status: 404, statusText: 'Not Found' });
		expect(agents).toEqual([{ id: 'a1', name: 'Code reviewer', detail: null }]);
	});

	it('no agent employee: no profile request', () => {
		let agents: unknown[] | null = null;
		directory.everWorksAgents('org-1', 'tenant-1').subscribe((entries) => (agents = entries));
		http.expectOne((req) => req.url === '/api/employee').flush({ items: [], total: 0 });
		expect(agents).toEqual([]);
	});

	it('reads the profile of every agent, a few at a time (none is left out)', () => {
		let count = -1;
		directory.everWorksAgents('org-1', 'tenant-1').subscribe((entries) => (count = entries.length));
		const many = Array.from({ length: 60 }, (_, index) => ({ id: `a${index}` }));
		http.expectOne((req) => req.url === '/api/employee').flush({ items: many, total: many.length });
		for (let index = 0; index < many.length; index++) {
			const pending = http.match((req) => req.url.endsWith('/agent-profile'));
			// At most a few in flight at once.
			expect(pending.length).toBeLessThanOrEqual(6);
			if (pending.length === 0) break;
			pending[0].flush({ source: 'ever_works', title: `Agent ${pending[0].request.url}` });
			for (const rest of pending.slice(1))
				rest.flush({ source: 'ever_works', title: `Agent ${rest.request.url}` });
		}
		expect(count).toBe(60);
	});
});
