import '../core/entities/internal';

import { FindOperator } from 'typeorm';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { ManagedEmployeeService } from './managed-employee.service';

const TENANT_ID = 'tenant-1';
const TEAM_MANAGED = 'team-managed';
const TEAM_OTHER = 'team-other';
const MANAGER = 'employee-manager';
const MEMBER = 'employee-member';
const LEFT_MEMBER = 'employee-left';
const OUTSIDER = 'employee-outsider';

interface IStoredMembership {
	employeeId: string;
	organizationTeamId: string;
	isManager?: boolean;
	isActive?: boolean | null;
	isArchived?: boolean | null;
	tenantId?: string;
}

const MEMBERSHIPS: IStoredMembership[] = [
	{ employeeId: MANAGER, organizationTeamId: TEAM_MANAGED, isManager: true },
	{ employeeId: MEMBER, organizationTeamId: TEAM_MANAGED },
	{ employeeId: LEFT_MEMBER, organizationTeamId: TEAM_MANAGED, isActive: false },
	{ employeeId: OUTSIDER, organizationTeamId: TEAM_OTHER },
	{ employeeId: MEMBER, organizationTeamId: TEAM_MANAGED, tenantId: 'tenant-2' }
];

/** Applies a TypeORM condition as the database would: a plain value, `In`, `Or`, `IsNull` and `Equal`. */
function matchesCondition(value: unknown, condition: unknown): boolean {
	if (!(condition instanceof FindOperator)) {
		return value === condition;
	}
	switch (condition.type) {
		case 'in':
			return (condition.value as unknown as unknown[]).includes(value);
		case 'or': {
			const alternatives = condition.value as unknown as unknown[];
			return alternatives.some((alternative) => matchesCondition(value, alternative));
		}
		case 'isNull':
			return value === null || value === undefined;
		case 'equal':
			return value === condition.value;
		default:
			throw new Error(`Unexpected TypeORM operator "${condition.type}"`);
	}
}

/**
 * A team-scoped report may also count the time a team's members logged without a team. Which members that covers is
 * decided here: the members of the teams the caller manages, the members of every requested team for a caller who
 * may act for every employee, and nobody else.
 */
describe('ManagedEmployeeService.findMembersOfReadableTeams', () => {
	let service: ManagedEmployeeService;
	let find: jest.Mock;
	let actsForEveryEmployee: boolean;

	beforeEach(() => {
		actsForEveryEmployee = false;
		find = jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
			MEMBERSHIPS.map((membership) => ({
				isManager: false,
				isActive: true,
				isArchived: false,
				tenantId: TENANT_ID,
				...membership
			})).filter((membership) =>
				Object.entries(where).every(([key, condition]) =>
					matchesCondition((membership as Record<string, unknown>)[key], condition)
				)
			)
		);
		service = new ManagedEmployeeService({ find } as any, {} as any);

		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ employeeId: MANAGER } as any);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
			(permission) => actsForEveryEmployee && permission === PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('answers the active members of the requested teams the caller manages, and of no other team', async () => {
		const members = await service.findMembersOfReadableTeams([TEAM_MANAGED, TEAM_OTHER]);

		expect([...members].sort()).toEqual([MANAGER, MEMBER].sort());
	});

	it('answers nobody for a caller who manages none of the requested teams', async () => {
		await expect(service.findMembersOfReadableTeams([TEAM_OTHER])).resolves.toEqual([]);

		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ employeeId: MEMBER } as any);
		await expect(service.findMembersOfReadableTeams([TEAM_MANAGED])).resolves.toEqual([]);
	});

	it('answers the active members of every requested team for a caller who may act for every employee', async () => {
		actsForEveryEmployee = true;

		const members = await service.findMembersOfReadableTeams([TEAM_MANAGED, TEAM_OTHER]);

		expect([...members].sort()).toEqual([MANAGER, MEMBER, OUTSIDER].sort());
	});

	it('answers nobody, without reading memberships, without teams or without an employee identity', async () => {
		await expect(service.findMembersOfReadableTeams([])).resolves.toEqual([]);

		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ employeeId: undefined } as any);
		await expect(service.findMembersOfReadableTeams([TEAM_MANAGED])).resolves.toEqual([]);

		expect(find).not.toHaveBeenCalled();
	});
});
