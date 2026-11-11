import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { LinearUiService } from './linear-ui.service';

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

	it('reads a task title, and answers null when the task cannot be read', async () => {
		const title = firstValueFrom(api.taskTitle('task-1'));
		http.expectOne((request) => request.url.endsWith('/tasks/task-1')).flush({ id: 'task-1', title: '  Fix login  ' });
		await expect(title).resolves.toBe('Fix login');

		const missing = firstValueFrom(api.taskTitle('task-2'));
		http.expectOne((request) => request.url.endsWith('/tasks/task-2')).flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
		await expect(missing).resolves.toBeNull();
	});
});
