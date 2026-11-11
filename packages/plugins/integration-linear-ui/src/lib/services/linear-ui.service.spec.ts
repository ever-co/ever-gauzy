import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { LinearUiService, TASK_TITLES_MAX } from './linear-ui.service';

const INTEGRATION = 'int-1';

/** The routes the conflict list reads and writes. */
describe('LinearUiService (conflicts)', () => {
	let api: LinearUiService;
	let http: HttpTestingController;

	beforeEach(() => {
		api = TestBed.inject(LinearUiService);
		http = TestBed.inject(HttpTestingController);
	});

	afterEach(() => http.verify());

	it('lists the conflicts with only the filters given', async () => {
		const open = firstValueFrom(api.conflicts(INTEGRATION));
		const plain = http.expectOne((request) => request.url.endsWith('/integration/linear/int-1/conflicts'));
		expect(plain.request.method).toBe('GET');
		expect(plain.request.params.keys()).toEqual([]);
		plain.flush([]);
		await expect(open).resolves.toEqual([]);

		void firstValueFrom(api.conflicts(INTEGRATION, { status: 'resolved', runId: 'run-1', mappingId: null, take: 20 }));
		const filtered = http.expectOne((request) => request.url.endsWith('/conflicts'));
		expect(filtered.request.params.get('status')).toBe('resolved');
		expect(filtered.request.params.get('runId')).toBe('run-1');
		expect(filtered.request.params.get('take')).toBe('20');
		expect(filtered.request.params.has('mappingId')).toBe(false);
		filtered.flush([]);
	});

	it('resolves a conflict with the choice the route takes', async () => {
		const resolved = firstValueFrom(api.resolveConflict(INTEGRATION, 'c/1', 'platform'));
		const request = http.expectOne((item) => item.url.endsWith('/integration/linear/int-1/conflicts/c%2F1/resolve'));
		expect(request.request.method).toBe('POST');
		expect(request.request.body).toEqual({ keep: 'platform' });
		request.flush({ id: 'c/1', status: 'resolved', resolution: 'kept_platform' });
		await expect(resolved).resolves.toMatchObject({ resolution: 'kept_platform' });
	});

	it('reads the titles of the listed tasks in one read of the task list (no visit is recorded)', async () => {
		const titles = firstValueFrom(api.taskTitles({ tenantId: 'tenant-1', organizationId: 'org-1' }, ['task-1', 'task-2', 'task-1', '']));
		const request = http.expectOne((item) => item.url.endsWith('/api/tasks'));
		expect(request.request.method).toBe('GET');
		expect(request.request.params.get('where[tenantId]')).toBe('tenant-1');
		expect(request.request.params.get('where[organizationId]')).toBe('org-1');
		expect(request.request.params.get('filters[ids][0]')).toBe('task-1');
		expect(request.request.params.get('filters[ids][1]')).toBe('task-2');
		expect(request.request.params.has('filters[ids][2]')).toBe(false);
		expect(request.request.params.get('select[title]')).toBe('true');
		expect(request.request.params.get('take')).toBe('2');
		request.flush({ items: [{ id: 'task-1', title: '  Fix login  ' }, { id: 'task-2', title: '' }], total: 2 });
		await expect(titles).resolves.toEqual({ 'task-1': 'Fix login' });
	});

	it('asks for no more ids than the task filter takes', () => {
		void firstValueFrom(api.taskTitles({ tenantId: 'tenant-1', organizationId: 'org-1' }, Array.from({ length: 30 }, (_, index) => `task-${index}`)));
		const request = http.expectOne((item) => item.url.endsWith('/api/tasks'));
		expect(request.request.params.get(`filters[ids][${TASK_TITLES_MAX - 1}]`)).toBe(`task-${TASK_TITLES_MAX - 1}`);
		expect(request.request.params.has(`filters[ids][${TASK_TITLES_MAX}]`)).toBe(false);
		request.flush({ items: [] });
	});

	it('answers null when the read fails (asked again later), and reads nothing for no task', async () => {
		const failed = firstValueFrom(api.taskTitles({ tenantId: 'tenant-1', organizationId: 'org-1' }, ['task-1']));
		http.expectOne((item) => item.url.endsWith('/api/tasks')).flush({ message: 'Down' }, { status: 503, statusText: 'Unavailable' });
		await expect(failed).resolves.toBeNull();

		await expect(firstValueFrom(api.taskTitles({ tenantId: 'tenant-1', organizationId: 'org-1' }, []))).resolves.toEqual({});
		http.expectNone((item) => item.url.endsWith('/api/tasks'));
	});
});
