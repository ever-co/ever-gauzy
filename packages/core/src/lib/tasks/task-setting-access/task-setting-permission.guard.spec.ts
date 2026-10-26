/**
 * 🛑 This import must stay FIRST, before anything that pulls a core controller — see the note at the top of
 * `mutating-route-permissions.spec.ts`: entering the entity graph from a controller leaves a decorator module
 * half-initialized.
 */
import 'reflect-metadata';
import '../../core/entities/internal';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FindOperator } from 'typeorm';
import { IUser, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { IssueTypeController } from '../issue-type/issue-type.controller';
import { IssueTypeService } from '../issue-type/issue-type.service';
import { TaskPriorityController } from '../priorities/priority.controller';
import { TaskPriorityService } from '../priorities/priority.service';
import { TaskRelatedIssueTypeController } from '../related-issue-type/related-issue-type.controller';
import { TaskRelatedIssueTypeService } from '../related-issue-type/related-issue-type.service';
import { TaskSizeController } from '../sizes/size.controller';
import { TaskSizeService } from '../sizes/size.service';
import { TaskStatusController } from '../statuses/status.controller';
import { TaskStatusService } from '../statuses/status.service';
import { TaskMetadataResolver } from '../task-metadata.resolver';
import { TaskVersionController } from '../versions/version.controller';
import { TaskVersionService } from '../versions/version.service';
import { TaskSettingPermissionGuard } from './task-setting-permission.guard';
import { ITeamManagerMembership } from './task-setting-team-managers';

/**
 * Owner decision 2(b) (2026-10-23): task settings that belong to a team (`organizationTeamId` set) may be created,
 * changed and removed by that team's managers — the flag Ever Teams uses, `isManager` or the membership's `MANAGER`
 * role — or by an `ORG_TASK_SETTING` holder; the organization's own task settings still need `ORG_TASK_SETTING`.
 *
 * The guard runs on the real route and field metadata of the six controllers and the resolver. The permission half is
 * `PermissionGuard`'s own, decided from the request's role state; the rows and the memberships are scripted.
 */
describe('TaskSettingPermissionGuard — a team’s managers write the team’s task settings', () => {
	const TENANT = 'a0000000-0000-4000-8000-000000000001';
	const MANAGER_EMPLOYEE = 'e0000000-0000-4000-8000-000000000001';

	const TEAM_FLAGGED = 'f0000000-0000-4000-8000-00000000000a'; // managed through `isManager`
	const TEAM_ROLE = 'f0000000-0000-4000-8000-00000000000b'; // managed through the MANAGER membership role
	const TEAM_MEMBER = 'f0000000-0000-4000-8000-00000000000c'; // a plain member
	const TEAM_ARCHIVED = 'f0000000-0000-4000-8000-00000000000d'; // a manager membership that is archived
	const TEAM_OTHER = 'f0000000-0000-4000-8000-00000000000e'; // not a member at all

	const ROW_FLAGGED = 'c0000000-0000-4000-8000-000000000001';
	const ROW_FLAGGED_2 = 'c0000000-0000-4000-8000-000000000002';
	const ROW_ROLE = 'c0000000-0000-4000-8000-000000000003';
	const ROW_MEMBER = 'c0000000-0000-4000-8000-000000000004';
	const ROW_ORGANIZATION = 'c0000000-0000-4000-8000-000000000005';
	const MISSING_ROW = 'c0000000-0000-4000-8000-000000000099';

	const STORED: Record<string, { id: string; organizationTeamId: string | null }> = {
		[ROW_FLAGGED]: { id: ROW_FLAGGED, organizationTeamId: TEAM_FLAGGED },
		[ROW_FLAGGED_2]: { id: ROW_FLAGGED_2, organizationTeamId: TEAM_FLAGGED },
		[ROW_ROLE]: { id: ROW_ROLE, organizationTeamId: TEAM_ROLE },
		[ROW_MEMBER]: { id: ROW_MEMBER, organizationTeamId: TEAM_MEMBER },
		[ROW_ORGANIZATION]: { id: ROW_ORGANIZATION, organizationTeamId: null }
	};

	const MEMBERSHIPS: Array<ITeamManagerMembership & { employeeId: string }> = [
		{ employeeId: MANAGER_EMPLOYEE, organizationTeamId: TEAM_FLAGGED, isManager: true, isActive: true },
		{
			employeeId: MANAGER_EMPLOYEE,
			organizationTeamId: TEAM_ROLE,
			isManager: false,
			isActive: null,
			role: { name: RolesEnum.MANAGER }
		},
		{ employeeId: MANAGER_EMPLOYEE, organizationTeamId: TEAM_MEMBER, isManager: false, isActive: true },
		{ employeeId: MANAGER_EMPLOYEE, organizationTeamId: TEAM_ARCHIVED, isManager: true, isArchived: true },
		{ employeeId: 'someone-else', organizationTeamId: TEAM_OTHER, isManager: true, isActive: true }
	];

	let guard: TaskSettingPermissionGuard;
	let rows: { findOneByIdString: jest.Mock; find: jest.Mock };
	let moduleRef: { get: jest.Mock };
	let memberships: { find: jest.Mock };

	/** Signs a user in with the role state a request attaches: their role, in this tenant, and its permissions. */
	const signIn = (
		role: RolesEnum,
		permissions: PermissionsEnum[] = [],
		employeeId: string | null = MANAGER_EMPLOYEE
	) => {
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
			id: 'user-1',
			tenantId: TENANT,
			employeeId,
			role: { id: 'role-1', name: role, tenantId: TENANT },
			permissions
		} as unknown as IUser);
	};

	const valuesOf = (operator: unknown): string[] =>
		operator instanceof FindOperator ? ((operator.value as unknown as string[]) ?? []) : [];

	/** A REST call of one controller route. */
	const rest = (
		controller: Function,
		handler: string,
		request: { params?: Record<string, string>; body?: unknown }
	): ExecutionContext =>
		({
			getHandler: () => (controller.prototype as Record<string, Function>)[handler],
			getClass: () => controller,
			getType: () => 'http',
			switchToHttp: () => ({ getRequest: () => ({ params: {}, ...request }) })
		}) as unknown as ExecutionContext;

	/** A GraphQL call of one resolver field. */
	const graphql = (field: string, args: Record<string, unknown>): ExecutionContext =>
		({
			getHandler: () => (TaskMetadataResolver.prototype as unknown as Record<string, Function>)[field],
			getClass: () => TaskMetadataResolver,
			getType: () => 'graphql',
			getArgs: () => [{}, args, { req: {} }, {}],
			getArgByIndex: (index: number) => [{}, args, { req: {} }, {}][index]
		}) as unknown as ExecutionContext;

	beforeEach(() => {
		rows = {
			findOneByIdString: jest.fn(async (id: string) => {
				if (!STORED[id]) {
					throw new NotFoundException();
				}
				return STORED[id];
			}),
			find: jest.fn(async ({ where }: { where: { id: unknown } }) =>
				valuesOf(where.id)
					.filter((id) => STORED[id])
					.map((id) => STORED[id])
			)
		};
		moduleRef = { get: jest.fn(() => rows) };
		memberships = {
			find: jest.fn(async ({ where }: { where: { employeeId: string; organizationTeamId: unknown } }) =>
				MEMBERSHIPS.filter(
					(membership) =>
						membership.employeeId === where.employeeId &&
						valuesOf(where.organizationTeamId).includes(membership.organizationTeamId)
				)
			)
		};

		const cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn() };
		const rolePermissionService = { checkRolePermission: jest.fn().mockResolvedValue(false) };
		guard = new TaskSettingPermissionGuard(
			cache as never,
			new Reflector(),
			rolePermissionService as never,
			moduleRef as never
		);
		jest.spyOn(guard as unknown as { teamMemberships: () => unknown }, 'teamMemberships').mockReturnValue(
			memberships
		);
	});

	afterEach(() => jest.restoreAllMocks());

	describe('an ORG_TASK_SETTING holder', () => {
		it('writes the organization’s own task settings and every team’s, without a membership read', async () => {
			signIn(RolesEnum.ADMIN, [PermissionsEnum.ORG_TASK_SETTING]);

			await expect(guard.canActivate(rest(TaskStatusController, 'create', { body: {} }))).resolves.toBe(true);
			await expect(
				guard.canActivate(rest(TaskStatusController, 'update', { params: { id: ROW_ORGANIZATION }, body: {} }))
			).resolves.toBe(true);
			await expect(
				guard.canActivate(
					rest(TaskStatusController, 'create', { body: { organizationTeamId: TEAM_OTHER } })
				)
			).resolves.toBe(true);
			expect(memberships.find).not.toHaveBeenCalled();
			expect(rows.findOneByIdString).not.toHaveBeenCalled();
		});
	});

	describe('a team manager without the grant', () => {
		beforeEach(() => signIn(RolesEnum.MANAGER));

		it('creates a task setting in a team they manage, by the flag or by the membership role', async () => {
			await expect(
				guard.canActivate(rest(TaskStatusController, 'create', { body: { organizationTeamId: TEAM_FLAGGED } }))
			).resolves.toBe(true);
			await expect(
				guard.canActivate(
					rest(TaskStatusController, 'create', { body: { organizationTeam: { id: TEAM_ROLE } } })
				)
			).resolves.toBe(true);
			expect(moduleRef.get).toHaveBeenCalledWith(TaskStatusService, { strict: false });
		});

		it('is refused in a team they only belong to, one they are not in, or by an archived membership', async () => {
			for (const team of [TEAM_MEMBER, TEAM_OTHER, TEAM_ARCHIVED]) {
				await expect(
					guard.canActivate(rest(TaskStatusController, 'create', { body: { organizationTeamId: team } }))
				).resolves.toBe(false);
			}
		});

		it('is refused an organization-wide task setting, created or stored', async () => {
			await expect(guard.canActivate(rest(TaskStatusController, 'create', { body: {} }))).resolves.toBe(false);
			await expect(
				guard.canActivate(rest(TaskStatusController, 'create', { body: { organizationTeamId: null } }))
			).resolves.toBe(false);
			await expect(
				guard.canActivate(rest(TaskStatusController, 'update', { params: { id: ROW_ORGANIZATION }, body: {} }))
			).resolves.toBe(false);
			await expect(
				guard.canActivate(rest(TaskStatusController, 'delete', { params: { id: ROW_ORGANIZATION } }))
			).resolves.toBe(false);
			expect(memberships.find).not.toHaveBeenCalled();
		});

		it('changes their team’s row, and is refused another team’s', async () => {
			await expect(
				guard.canActivate(
					rest(TaskStatusController, 'update', { params: { id: ROW_FLAGGED }, body: { name: 'Doing' } })
				)
			).resolves.toBe(true);
			await expect(
				guard.canActivate(
					rest(TaskStatusController, 'update', { params: { id: ROW_MEMBER }, body: { name: 'Doing' } })
				)
			).resolves.toBe(false);
		});

		it('may move a row between two teams they manage, and nowhere else', async () => {
			const move = (organizationTeamId: string | null) =>
				guard.canActivate(
					rest(TaskStatusController, 'update', { params: { id: ROW_FLAGGED }, body: { organizationTeamId } })
				);

			await expect(move(TEAM_ROLE)).resolves.toBe(true);
			await expect(move(TEAM_MEMBER)).resolves.toBe(false);
			// Out of the team, into the organization's own task settings
			await expect(move(null)).resolves.toBe(false);
		});

		it('removes, withdraws and restores their team’s row, and is refused another team’s', async () => {
			for (const handler of ['delete', 'softRemove', 'softRecover']) {
				await expect(
					guard.canActivate(rest(TaskStatusController, handler, { params: { id: ROW_FLAGGED } }))
				).resolves.toBe(true);
				await expect(
					guard.canActivate(rest(TaskStatusController, handler, { params: { id: ROW_MEMBER } }))
				).resolves.toBe(false);
			}
			expect(rows.findOneByIdString).toHaveBeenCalledWith(ROW_FLAGGED, { withDeleted: true });
		});

		it('reorders the board when every row is of a team they manage, and is refused any other list', async () => {
			const reorder = (...ids: string[]) =>
				guard.canActivate(
					rest(TaskStatusController, 'reorder', {
						body: { reorder: ids.map((id, order) => ({ id, order })) }
					})
				);

			await expect(reorder(ROW_FLAGGED, ROW_FLAGGED_2, ROW_ROLE)).resolves.toBe(true);
			await expect(reorder(ROW_FLAGGED, ROW_MEMBER)).resolves.toBe(false);
			await expect(reorder(ROW_FLAGGED, ROW_ORGANIZATION)).resolves.toBe(false);
			// A row that is not there (or not the caller's tenant's) is no row of theirs
			await expect(reorder(ROW_FLAGGED, MISSING_ROW)).resolves.toBe(false);
			await expect(reorder()).resolves.toBe(false);
		});

		it('marks their team’s row the default of their team, and is refused a scope of another team', async () => {
			await expect(
				guard.canActivate(
					rest(TaskStatusController, 'markAsDefault', { params: { id: ROW_FLAGGED }, body: {} })
				)
			).resolves.toBe(true);
			await expect(
				guard.canActivate(
					rest(IssueTypeController, 'markAsDefault', {
						params: { id: ROW_FLAGGED },
						body: { organizationTeamId: TEAM_FLAGGED }
					})
				)
			).resolves.toBe(true);
			await expect(
				guard.canActivate(
					rest(TaskStatusController, 'markAsDefault', {
						params: { id: ROW_FLAGGED },
						body: { organizationTeamId: TEAM_MEMBER }
					})
				)
			).resolves.toBe(false);
			expect(moduleRef.get).toHaveBeenCalledWith(IssueTypeService, { strict: false });
		});

		it('is refused a row it cannot read, as before', async () => {
			await expect(
				guard.canActivate(rest(TaskStatusController, 'delete', { params: { id: MISSING_ROW } }))
			).resolves.toBe(false);
		});
	});

	it('refuses an employee who manages no team and holds no grant', async () => {
		signIn(RolesEnum.EMPLOYEE, [], 'plain-employee');

		await expect(
			guard.canActivate(rest(TaskStatusController, 'create', { body: { organizationTeamId: TEAM_FLAGGED } }))
		).resolves.toBe(false);
	});

	it('refuses a caller with no employee of their own', async () => {
		signIn(RolesEnum.VIEWER, [], null);

		await expect(
			guard.canActivate(rest(TaskStatusController, 'create', { body: { organizationTeamId: TEAM_FLAGGED } }))
		).resolves.toBe(false);
		expect(memberships.find).not.toHaveBeenCalled();
	});

	it.each([
		[IssueTypeController, IssueTypeService],
		[TaskPriorityController, TaskPriorityService],
		[TaskRelatedIssueTypeController, TaskRelatedIssueTypeService],
		[TaskSizeController, TaskSizeService],
		[TaskStatusController, TaskStatusService],
		[TaskVersionController, TaskVersionService]
	])('applies the same rule to every write of %p', async (controller, service) => {
		signIn(RolesEnum.MANAGER);

		await expect(
			guard.canActivate(rest(controller, 'create', { body: { organizationTeamId: TEAM_FLAGGED } }))
		).resolves.toBe(true);
		await expect(guard.canActivate(rest(controller, 'create', { body: {} }))).resolves.toBe(false);
		await expect(
			guard.canActivate(rest(controller, 'update', { params: { id: ROW_FLAGGED }, body: {} }))
		).resolves.toBe(true);
		await expect(
			guard.canActivate(rest(controller, 'update', { params: { id: ROW_MEMBER }, body: {} }))
		).resolves.toBe(false);
		for (const handler of ['delete', 'softRemove', 'softRecover']) {
			await expect(guard.canActivate(rest(controller, handler, { params: { id: ROW_FLAGGED } }))).resolves.toBe(
				true
			);
			await expect(
				guard.canActivate(rest(controller, handler, { params: { id: ROW_ORGANIZATION } }))
			).resolves.toBe(false);
		}
		expect(moduleRef.get).toHaveBeenCalledWith(service, { strict: false });
	});

	describe('over GraphQL', () => {
		beforeEach(() => signIn(RolesEnum.MANAGER));

		it('reads the same rows from the fields’ arguments', async () => {
			await expect(
				guard.canActivate(
					graphql('createTaskStatus', { input: { name: 'Doing', organizationTeamId: TEAM_FLAGGED } })
				)
			).resolves.toBe(true);
			await expect(
				guard.canActivate(graphql('createTaskSize', { input: { name: 'XL' } }))
			).resolves.toBe(false);
			await expect(
				guard.canActivate(graphql('updateTaskStatus', { input: { id: ROW_FLAGGED, name: 'Doing' } }))
			).resolves.toBe(true);
			await expect(
				guard.canActivate(
					graphql('updateTaskPriority', { input: { id: ROW_FLAGGED, organizationTeamId: null } })
				)
			).resolves.toBe(false);
			await expect(guard.canActivate(graphql('deleteIssueType', { id: ROW_ROLE }))).resolves.toBe(true);
			await expect(guard.canActivate(graphql('recoverTaskVersion', { id: ROW_MEMBER }))).resolves.toBe(false);
			await expect(
				guard.canActivate(
					graphql('reorderTaskStatuses', {
						reorder: [
							{ id: ROW_FLAGGED, order: 1 },
							{ id: ROW_ROLE, order: 2 }
						]
					})
				)
			).resolves.toBe(true);
			await expect(
				guard.canActivate(
					graphql('markIssueTypeAsDefault', { id: ROW_FLAGGED, scope: { organizationTeamId: TEAM_OTHER } })
				)
			).resolves.toBe(false);
		});
	});
});
