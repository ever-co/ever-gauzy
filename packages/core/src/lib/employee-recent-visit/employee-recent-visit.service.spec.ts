import '../core/entities/internal';

import { BaseEntityEnum, IEmployeeRecentVisit } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { EmployeeRecentVisitService } from './employee-recent-visit.service';

const TENANT_ID = 'tenant-1';
const ORGANIZATION_ID = 'organization-1';
const EMPLOYEE_ID = 'employee-1';
const TASK_ID = 'task-1';

/**
 * A repeat visit of the same entity updates the existing entry instead of adding one. It used to move only
 * `visitedAt`, so the `data` snapshot stored on the first visit (e.g. a task's title and status) was
 * shown in the recent list forever after, however the entity had changed since.
 */
describe('EmployeeRecentVisitService.create on a repeat visit', () => {
	let existingEntry: IEmployeeRecentVisit;
	let stub: { typeOrmEmployeeRecentVisitRepository: { findOne: jest.Mock }; save: jest.Mock };

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(EMPLOYEE_ID);

		existingEntry = {
			id: 'visit-1',
			entity: BaseEntityEnum.Task,
			entityId: TASK_ID,
			employeeId: EMPLOYEE_ID,
			organizationId: ORGANIZATION_ID,
			tenantId: TENANT_ID,
			visitedAt: new Date('2026-01-01T00:00:00.000Z'),
			data: { title: 'Old title', status: 'open' }
		} as IEmployeeRecentVisit;
		stub = {
			typeOrmEmployeeRecentVisitRepository: { findOne: jest.fn().mockResolvedValue(existingEntry) },
			save: jest.fn(async (entry) => entry)
		};
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	const visit = (data?: IEmployeeRecentVisit['data']) =>
		EmployeeRecentVisitService.prototype.create.call(stub, {
			entity: BaseEntityEnum.Task,
			entityId: TASK_ID,
			organizationId: ORGANIZATION_ID,
			...(data !== undefined && { data })
		} as IEmployeeRecentVisit);

	it('stores the snapshot of the latest visit along with the new visitedAt', async () => {
		const saved = await visit({ title: 'New title', status: 'done' });

		expect(stub.save).toHaveBeenCalledTimes(1);
		expect(saved.data).toEqual({ title: 'New title', status: 'done' });
		expect(saved.visitedAt.getTime()).toBeGreaterThan(new Date('2026-01-01T00:00:00.000Z').getTime());
	});

	it('CONTROL: keeps the stored snapshot when the visit carries no data', async () => {
		const saved = await visit();

		expect(saved.data).toEqual({ title: 'Old title', status: 'open' });
		expect(saved.visitedAt.getTime()).toBeGreaterThan(new Date('2026-01-01T00:00:00.000Z').getTime());
	});
});
