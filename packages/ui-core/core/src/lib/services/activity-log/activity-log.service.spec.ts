import { HttpClient, HttpParams } from '@angular/common/http';
import { of } from 'rxjs';
import { BaseEntityEnum } from '@gauzy/contracts';
import { ACTIVITY_LOG_PAGE_SIZE, ActivityLogService } from './activity-log.service';

/**
 * The activity log API reads `skip` as a 1-based page number and refuses a read without the organization,
 * so the client sends the page as `skip`, always sends the organization, and leaves absent filters out.
 */
describe('ActivityLogService', () => {
	let http: { get: jest.Mock };
	let service: ActivityLogService;

	const params = (): HttpParams => http.get.mock.calls[0][1].params;

	beforeEach(() => {
		http = { get: jest.fn(() => of({ items: [], total: 0 })) };
		service = new ActivityLogService(http as unknown as HttpClient);
	});

	it('reads the newest activity of the organization, a page of ten, with the authors', async () => {
		await service.getPage({ organizationId: 'org-1', tenantId: 'tenant-1' });

		expect(http.get.mock.calls[0][0]).toMatch(/\/activity-log$/);
		expect(params().get('organizationId')).toBe('org-1');
		expect(params().get('tenantId')).toBe('tenant-1');
		expect(params().get('orderBy')).toBe('createdAt');
		expect(params().get('order')).toBe('DESC');
		expect(params().get('take')).toBe(String(ACTIVITY_LOG_PAGE_SIZE));
		expect(params().get('skip')).toBe('1');
		expect(params().get('relations[0]')).toBe('employee');
		expect(params().get('relations[1]')).toBe('employee.user');
	});

	it('sends the page as `skip`, never below the first', async () => {
		await service.getPage({ organizationId: 'org-1', page: 3 });
		await service.getPage({ organizationId: 'org-1', page: 0 });

		expect(http.get.mock.calls[0][1].params.get('skip')).toBe('3');
		expect(http.get.mock.calls[1][1].params.get('skip')).toBe('1');
	});

	it('filters by kind and record when asked, and leaves absent filters out', async () => {
		await service.getPage({ organizationId: 'org-1', entity: BaseEntityEnum.Task, entityId: 'task-1' });
		await service.getPage({ organizationId: 'org-1' });

		expect(http.get.mock.calls[0][1].params.get('entity')).toBe(BaseEntityEnum.Task);
		expect(http.get.mock.calls[0][1].params.get('entityId')).toBe('task-1');
		const bare: HttpParams = http.get.mock.calls[1][1].params;
		expect(bare.has('entity')).toBe(false);
		expect(bare.has('entityId')).toBe(false);
		expect(bare.has('tenantId')).toBe(false);
	});
});
