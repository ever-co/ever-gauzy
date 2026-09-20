// Must stay first: loads the entity graph before any handler pulls an entity (see activity.controller.spec.ts).
import '../../../../core/entities/internal';

import { ForbiddenException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../../../../core/context';
import { BulkActivitiesSaveCommand } from '../bulk-activities-save.command';
import { BulkActivitiesSaveHandler } from './bulk-activities-save.handler';

/**
 * GHSA-6qvm-3wg4-26w4 — POST /timesheet/activity/bulk.
 *
 * The handler resolved a body employeeId with `findOneBy({ id })` in any tenant, fell back to a body
 * tenantId, and saved body activities with their own ids (an upsert by primary key). The fakes below
 * evaluate the where clause against fixtures; CONTROL arms replay the pre-fix call shapes.
 */

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';

const EMPLOYEES = [
	{ id: 'employee-a', tenantId: TENANT_A, organizationId: 'org-a' },
	{ id: 'employee-b', tenantId: TENANT_B, organizationId: 'org-b' }
];

const ACTIVITIES = [
	{ id: 'activity-own', tenantId: TENANT_A, employeeId: 'employee-a' },
	{ id: 'activity-foreign', tenantId: TENANT_B, employeeId: 'employee-b' }
];

const matches = (row: Record<string, any>, where: Record<string, any>) =>
	Object.entries(where).every(([key, value]) =>
		value === undefined ? true : value instanceof FindOperator ? (value.value as any[]).includes(row[key]) : row[key] === value
	);

function createHandler() {
	const employeeRepository = {
		findOneBy: jest.fn(async (where: any) => EMPLOYEES.find((employee) => matches(employee, where)) ?? null)
	};
	const activityRepository = {
		find: jest.fn(async ({ where }: any) => ACTIVITIES.filter((activity) => matches(activity, where))),
		save: jest.fn(async (activities: any[]) => activities),
		metadata: { findRelationWithPropertyPath: (): undefined => undefined },
		manager: {}
	};
	const handler = new BulkActivitiesSaveHandler(activityRepository as any, employeeRepository as any);
	return { handler, employeeRepository, activityRepository };
}

function asCaller(options: { tenantId?: string | null; employeeId?: string | null; canChangeEmployee?: boolean }) {
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(
		(options.tenantId === undefined ? TENANT_A : options.tenantId) as any
	);
	jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue((options.employeeId ?? null) as any);
	jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ name: 'caller' } as any);
	jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
		(permission) => !!options.canChangeEmployee && permission === PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
	);
}

describe('BulkActivitiesSaveHandler (GHSA-6qvm-3wg4-26w4)', () => {
	beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
	afterEach(() => jest.restoreAllMocks());

	it('CONTROL: the pre-fix employee lookup resolves an employee of another tenant', async () => {
		const { employeeRepository } = createHandler();

		expect(await employeeRepository.findOneBy({ id: 'employee-b' })).toMatchObject({ tenantId: TENANT_B });
	});

	it('refuses an employee of another tenant named by a CHANGE_SELECTED_EMPLOYEE holder', async () => {
		const { handler, employeeRepository, activityRepository } = createHandler();
		asCaller({ canChangeEmployee: true });

		await expect(
			handler.execute(
				new BulkActivitiesSaveCommand({ employeeId: 'employee-b', activities: [{ title: 'x' }] } as any)
			)
		).rejects.toThrow(ForbiddenException);

		expect(employeeRepository.findOneBy).toHaveBeenCalledWith({ id: 'employee-b', tenantId: TENANT_A });
		expect(activityRepository.save).not.toHaveBeenCalled();
	});

	it('refuses to fall back to a body tenantId when the request has none', async () => {
		const { handler, activityRepository } = createHandler();
		asCaller({ tenantId: null, employeeId: 'employee-a' });

		await expect(
			handler.execute(
				new BulkActivitiesSaveCommand({ tenantId: TENANT_B, activities: [{ title: 'x' }] } as any)
			)
		).rejects.toThrow(ForbiddenException);
		expect(activityRepository.save).not.toHaveBeenCalled();
	});

	it("never saves under another tenant's activity id, and keeps the employee's own", async () => {
		const { handler, activityRepository } = createHandler();
		asCaller({ employeeId: 'employee-a' });

		await handler.execute(
			new BulkActivitiesSaveCommand({
				activities: [
					{ id: 'activity-foreign', title: 'steal', tenant: { id: TENANT_B } },
					{ id: 'activity-own', title: 'resend' }
				]
			} as any)
		);

		const saved = activityRepository.save.mock.calls[0][0];
		expect(saved.map((activity: any) => activity.id)).toEqual([undefined, 'activity-own']);
		for (const activity of saved) {
			expect(activity).toMatchObject({ tenantId: TENANT_A, employeeId: 'employee-a', organizationId: 'org-a' });
			expect(activity.tenant).toBeUndefined();
		}
	});
});
