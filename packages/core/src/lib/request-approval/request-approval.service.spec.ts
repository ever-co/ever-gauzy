// Must stay first: loads the entity graph before the service pulls an entity (see activity.controller.spec.ts).
import '../core/entities/internal';

import { FindOperator, In } from 'typeorm';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { RequestApprovalService } from './request-approval.service';

/**
 * GHSA-gwpq-mmw7-vx85 sibling — POST / PUT /request-approval resolved the body's approver employees
 * and teams through raw repositories with no tenant predicate, attached the loaded rows, and echoed
 * them back: a foreign-tenant employee or team was read and linked by its UUID.
 *
 * The fake repositories evaluate the where clause against fixtures. CONTROL arms replay the pre-fix
 * `{ id: In(ids) }` lookups and show the foreign rows coming back.
 */

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';

const EMPLOYEES = [
	{ id: 'employee-own', tenantId: TENANT_A },
	{ id: 'employee-foreign', tenantId: TENANT_B }
];
const TEAMS = [
	{ id: 'team-own', tenantId: TENANT_A },
	{ id: 'team-foreign', tenantId: TENANT_B }
];

const matches = (row: Record<string, any>, where: Record<string, any>) =>
	Object.entries(where).every(([key, value]) =>
		value === undefined ? true : value instanceof FindOperator ? (value.value as any[]).includes(row[key]) : row[key] === value
	);

const fakeRepository = (rows: any[]) => ({
	find: jest.fn(async ({ where }: any) => rows.filter((row) => matches(row, where)))
});

function createService() {
	const employees = fakeRepository(EMPLOYEES);
	const teams = fakeRepository(TEAMS);
	// updateRequestApproval clears the previous approver rows through a query builder first.
	const requestApprovals = {
		createQueryBuilder: () => {
			const builder: any = {
				delete: () => builder,
				from: () => builder,
				where: () => builder,
				execute: async () => ({ affected: 0 })
			};
			return builder;
		}
	};
	const service = new RequestApprovalService(
		requestApprovals as any,
		{} as any,
		employees as any,
		{} as any,
		teams as any,
		{} as any
	);
	jest.spyOn(service, 'save').mockImplementation(async (entity: any) => entity);
	return { service, employees, teams };
}

describe('RequestApprovalService approver lookups (GHSA-gwpq-mmw7-vx85 sibling)', () => {
	beforeEach(() => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_A);
	});
	afterEach(() => jest.restoreAllMocks());

	const input: any = {
		name: 'approval',
		organizationId: 'org-a',
		employeeApprovals: ['employee-own', 'employee-foreign'],
		teams: ['team-own', 'team-foreign']
	};

	it('CONTROL: the pre-fix lookups return the foreign employee and team', async () => {
		const { employees, teams } = createService();

		expect((await employees.find({ where: { id: In(input.employeeApprovals) } })).map((e) => e.id)).toContain(
			'employee-foreign'
		);
		expect((await teams.find({ where: { id: In(input.teams) } })).map((t) => t.id)).toContain('team-foreign');
	});

	it('links only approvers of the caller tenant on create', async () => {
		const { service } = createService();

		const created: any = await service.createRequestApproval(input);

		expect(created.employeeApprovals.map((row: any) => row.employeeId)).toEqual(['employee-own']);
		expect(created.teamApprovals.map((row: any) => row.teamId)).toEqual(['team-own']);
		expect(JSON.stringify(created)).not.toContain(TENANT_B);
	});

	it('links only approvers of the caller tenant on update', async () => {
		const { service } = createService();
		jest.spyOn(service, 'findOneByIdString').mockResolvedValue({ id: 'approval-1', tenantId: TENANT_A } as any);

		const updated: any = await service.updateRequestApproval('approval-1', input);

		expect(updated.employeeApprovals.map((row: any) => row.employeeId)).toEqual(['employee-own']);
		expect(updated.teamApprovals.map((row: any) => row.teamId)).toEqual(['team-own']);
		expect(JSON.stringify(updated)).not.toContain(TENANT_B);
	});

	it('matches nothing without a tenant', async () => {
		const { service, employees } = createService();
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(null);

		const created: any = await service.createRequestApproval(input);

		expect(created.employeeApprovals).toEqual([]);
		expect(employees.find).not.toHaveBeenCalled();
	});
});
