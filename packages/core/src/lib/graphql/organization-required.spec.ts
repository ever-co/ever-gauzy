import '../core/entities/internal';

import { BadRequestException } from '@nestjs/common';
import { EmployeeResolver } from '../employee/employee.resolver';
import { OrganizationTeamResolver } from '../organization-team/organization-team.resolver';
import { TimesheetResolver } from '../time-tracking/timesheet/timesheet.resolver';

/**
 * Six GraphQL writes made the organization optional where their REST twin requires it (SEC-A-02).
 *
 * The REST routes take a `TenantOrganizationBaseDTO` / `DeleteQueryDTO` whose `organizationId` is required and
 * must be one of the caller's (`@IsOrganizationBelongsToUser`), and hand it to the criteria that narrow the write.
 * The GraphQL fields declared it nullable, the membership interceptor only checks an organization that is STATED,
 * and an omitted one is dropped from the criteria (`undefined: 'ignore'`) — so the write ran tenant-wide: an ADMIN
 * of organization A deleted organization B's employees and teams and approved its timesheets.
 *
 * Each field now refuses a call that names no organization before anything runs, as the route does.
 */
describe('GraphQL writes that require the organization their REST twin requires', () => {
	const ORG = 'c1000000-0000-4000-8000-0000000000a1';

	const employees = () => {
		const service = {
			delete: jest.fn(async () => ({ affected: 1 })),
			softRemovedById: jest.fn(async () => ({ id: 'e1' })),
			softRecoverById: jest.fn(async () => ({ id: 'e1' }))
		};
		return { service, resolver: new EmployeeResolver(service as any, {} as any) };
	};

	it.each(['deleteEmployee', 'softDeleteEmployee', 'recoverEmployee'] as const)(
		'%s refuses a call that names no organization, and touches nothing',
		async (field) => {
			const { service, resolver } = employees();

			await expect((resolver as any)[field]('e1')).rejects.toBeInstanceOf(BadRequestException);
			expect(service.delete).not.toHaveBeenCalled();
			expect(service.softRemovedById).not.toHaveBeenCalled();
			expect(service.softRecoverById).not.toHaveBeenCalled();
		}
	);

	it('still runs the employee writes inside the organization the caller names', async () => {
		const { service, resolver } = employees();

		await resolver.deleteEmployee('e1', ORG);
		await resolver.softDeleteEmployee('e1', ORG);
		await resolver.recoverEmployee('e1', ORG);

		expect(service.delete).toHaveBeenCalledWith('e1', { where: { organizationId: ORG } });
		expect(service.softRemovedById).toHaveBeenCalledWith('e1', { organizationId: ORG });
		expect(service.softRecoverById).toHaveBeenCalledWith('e1', { organizationId: ORG });
	});

	it('deleteOrganizationTeam refuses a call that names no organization, and touches nothing', async () => {
		const service = { deleteTeam: jest.fn(async () => undefined) };
		const resolver = new OrganizationTeamResolver(service as any, {} as any, {} as any);

		await expect(resolver.deleteOrganizationTeam('t1')).rejects.toBeInstanceOf(BadRequestException);
		await expect(resolver.deleteOrganizationTeam('t1', {} as any)).rejects.toBeInstanceOf(BadRequestException);
		expect(service.deleteTeam).not.toHaveBeenCalled();

		await resolver.deleteOrganizationTeam('t1', { organizationId: ORG } as any);
		expect(service.deleteTeam).toHaveBeenCalledWith('t1', { organizationId: ORG });
	});

	it.each(['updateTimesheetStatus', 'submitTimesheet'] as const)(
		'%s refuses a call that names no organization, and dispatches nothing',
		async (field) => {
			const commandBus = { execute: jest.fn(async () => []) };
			const resolver = new TimesheetResolver({} as any, commandBus as any);

			await expect((resolver as any)[field]({ ids: ['ts1'], status: 'APPROVED' })).rejects.toBeInstanceOf(
				BadRequestException
			);
			expect(commandBus.execute).not.toHaveBeenCalled();

			await (resolver as any)[field]({ ids: ['ts1'], status: 'APPROVED', organizationId: ORG });
			expect(commandBus.execute).toHaveBeenCalledTimes(1);
		}
	);
});
