import '../core/entities/internal';

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { OrganizationTeamService } from './organization-team.service';

/**
 * #10710 — "Remove From All Teams" (`existTeamsAsMember`) deletes only the rows where the user is a plain
 * member (no role), so they stay on the teams they manage; but it unassigned them from the tasks of every
 * team, the managed ones included. The unassign now runs once per team the user actually leaves.
 */
describe('OrganizationTeamService.existTeamsAsMember', () => {
	const USER = 'user-1';
	const EMPLOYEE = 'employee-1';

	let memberships: { organizationTeamId: string }[];
	let organizationTeamEmployeeService: { find: jest.Mock; findOneByOptions: jest.Mock; delete: jest.Mock };
	let taskService: { unassignEmployeeFromTeamTasks: jest.Mock };
	let service: OrganizationTeamService;

	beforeEach(() => {
		memberships = [];
		organizationTeamEmployeeService = {
			find: jest.fn(async () => memberships),
			// The single-row read the user's plain memberships were checked with before.
			findOneByOptions: jest.fn(async () => {
				if (!memberships.length) throw new NotFoundException('The requested record was not found');
				return memberships[0];
			}),
			delete: jest.fn(async () => ({ affected: memberships.length, raw: [] }))
		};
		taskService = { unassignEmployeeFromTeamTasks: jest.fn(async () => undefined) };

		service = new OrganizationTeamService(
			{} as any,
			{} as any,
			{} as any,
			{} as any,
			{} as any,
			{} as any,
			{} as any,
			{} as any,
			organizationTeamEmployeeService as any,
			{ findOneByIdString: jest.fn(async () => ({ id: USER })) } as any,
			{ findOneByOptions: jest.fn(async () => ({ id: EMPLOYEE, userId: USER })) } as any,
			taskService as any
		);

		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(USER);
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);
	});

	afterEach(() => jest.restoreAllMocks());

	it('unassigns the user from the tasks of the teams they leave only, once per team', async () => {
		// The plain memberships: team-a named by two rows, team-b by one. The team the user manages has a role,
		// so it is not among these rows.
		memberships = [
			{ organizationTeamId: 'team-a' },
			{ organizationTeamId: 'team-b' },
			{ organizationTeamId: 'team-a' }
		];

		await expect(service.existTeamsAsMember(USER)).resolves.toEqual({ affected: 3, raw: [] });

		expect(organizationTeamEmployeeService.find).toHaveBeenCalledWith({
			where: { employeeId: EMPLOYEE, roleId: IsNull() }
		});
		expect(taskService.unassignEmployeeFromTeamTasks.mock.calls).toEqual([
			[EMPLOYEE, 'team-a'],
			[EMPLOYEE, 'team-b']
		]);
		expect(organizationTeamEmployeeService.delete).toHaveBeenCalledWith({ employeeId: EMPLOYEE, roleId: IsNull() });
	});

	it('answers 403 and unassigns nothing when the user is not a plain member of any team', async () => {
		await expect(service.existTeamsAsMember(USER)).rejects.toThrow(ForbiddenException);

		expect(taskService.unassignEmployeeFromTeamTasks).not.toHaveBeenCalled();
		expect(organizationTeamEmployeeService.delete).not.toHaveBeenCalled();
	});

	it('still refuses to remove another user without CHANGE_SELECTED_EMPLOYEE', async () => {
		memberships = [{ organizationTeamId: 'team-a' }];

		await expect(service.existTeamsAsMember('another-user')).rejects.toThrow(ForbiddenException);

		expect(taskService.unassignEmployeeFromTeamTasks).not.toHaveBeenCalled();
	});

	it('lets a CHANGE_SELECTED_EMPLOYEE holder remove another user, scoped the same way', async () => {
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
			(permission) => permission === PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		);
		memberships = [{ organizationTeamId: 'team-b' }];

		await expect(service.existTeamsAsMember(USER)).resolves.toEqual({ affected: 1, raw: [] });

		expect(taskService.unassignEmployeeFromTeamTasks.mock.calls).toEqual([[EMPLOYEE, 'team-b']]);
	});
});
