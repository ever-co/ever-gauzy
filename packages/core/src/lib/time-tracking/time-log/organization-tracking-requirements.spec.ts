// Must stay first: see timer.service.spec.ts.
import '../../core/entities/internal';

import { BadRequestException } from '@nestjs/common';
import { EntityManager, FindOperator } from 'typeorm';
import { IOrganization } from '@gauzy/contracts';
import { OrganizationTeam, OrganizationTeamEmployee, Task } from '../../core/entities/internal';
import {
	ITrackingRequirements,
	TRACKING_FIELD_REQUIRED,
	assertRequiredContext,
	projectIdForEntry,
	teamIdForEntry
} from './organization-tracking-requirements';

/**
 * An organization can require a team and a project on every time entry. Both switches are off by default and an
 * entry is then accepted as sent. When one is on, the team and the project are filled where the server can tell them,
 * and an entry still missing a required field is refused with a 400 naming every missing field. The task, client,
 * description and reason switches stay with the clients that check them.
 */

const EMPLOYEE = { employeeId: 'employee-1', organizationId: 'organization-1', tenantId: 'tenant-1' };

/** Applies a TypeORM condition as the database would: a plain value, `Or`, `IsNull` and `Equal`. */
function matchesCondition(value: unknown, condition: unknown): boolean {
	if (!(condition instanceof FindOperator)) {
		return value === condition;
	}
	switch (condition.type) {
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

/** Whether a stored row passes every condition the lookup states for it. */
function matchesWhere(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
	return Object.entries(where).every(([key, condition]) => matchesCondition(row[key], condition));
}

interface IStoredMembership {
	organizationTeamId: string;
	employeeId?: string;
	organizationId?: string;
	tenantId?: string;
	isActive?: boolean | null;
	isArchived?: boolean | null;
	team?: Record<string, unknown>;
}

interface IStore {
	memberships?: IStoredMembership[];
	tasks?: Record<string, unknown>[];
	teams?: Record<string, unknown>[];
}

/** A manager over stored memberships, tasks and teams that answers lookups the way the database would. */
function managerOver({ memberships = [], tasks = [], teams = [] }: IStore) {
	const find = jest.fn(async (_entity: unknown, { where }: { where: Record<string, unknown> }) => {
		const { organizationTeam: teamWhere, ...membershipWhere } = where;
		return memberships
			.map((membership) => ({
				...EMPLOYEE,
				isActive: true,
				isArchived: false,
				...membership,
				team: {
					organizationId: EMPLOYEE.organizationId,
					tenantId: EMPLOYEE.tenantId,
					isActive: true,
					isArchived: false,
					deletedAt: null,
					...membership.team
				}
			}))
			.filter((membership) => matchesWhere(membership, membershipWhere))
			.filter((membership) => matchesWhere(membership.team, teamWhere as Record<string, unknown>))
			.map(({ organizationTeamId }) => ({ id: `member-${organizationTeamId}`, organizationTeamId }));
	});
	const findOne = jest.fn(async (entity: unknown, { where }: { where: Record<string, unknown> }) => {
		const rows = entity === OrganizationTeam ? teams : tasks;
		return rows.find((row) => matchesWhere(row, where)) ?? null;
	});
	return { manager: { find, findOne } as unknown as EntityManager, find, findOne };
}

const BOTH_ON: ITrackingRequirements = { requireTeam: true, requireProject: true };

/** The refusal `assertRequiredContext` throws, or undefined when it accepts the entry. */
function refusalOf(requirements: ITrackingRequirements | undefined, entry: Record<string, unknown>) {
	try {
		assertRequiredContext(requirements, entry);
		return undefined;
	} catch (error) {
		expect(error).toBeInstanceOf(BadRequestException);
		return (error as BadRequestException).getResponse() as { message: string; code: string; fields: string[] };
	}
}

describe('assertRequiredContext', () => {
	const clientSideOnly = {
		requireTask: true,
		requireClient: true,
		requireDescription: true,
		requireReason: true
	} as IOrganization;

	it.each([undefined, {}, clientSideOnly])(
		'accepts an empty entry when neither switch is on (%p)',
		(requirements) => {
			expect(refusalOf(requirements, {})).toBeUndefined();
		}
	);

	it.each([
		['requireTeam', 'organizationTeamId', 'a team'],
		['requireProject', 'projectId', 'a project']
	])('refuses with a 400 naming the field when %s is on and %s is missing', (requirement, field, label) => {
		const requirements = { [requirement]: true } as ITrackingRequirements;
		const complete = { organizationTeamId: 'team-1', projectId: 'project-1' };
		const entry = { ...complete, [field]: undefined };

		expect(refusalOf(requirements, entry)).toEqual({
			message: `Your organization requires ${label} on every time entry. Add it and try again.`,
			code: TRACKING_FIELD_REQUIRED,
			fields: [field]
		});
		expect(refusalOf(requirements, complete)).toBeUndefined();
		expect(refusalOf({ [requirement]: false } as ITrackingRequirements, entry)).toBeUndefined();
	});

	it('names both missing fields in one refusal', () => {
		expect(refusalOf(BOTH_ON, { taskId: 'task-1', projectId: '' })).toEqual({
			message: 'Your organization requires a team and a project on every time entry. Add them and try again.',
			code: TRACKING_FIELD_REQUIRED,
			fields: ['organizationTeamId', 'projectId']
		});
	});
});

describe('teamIdForEntry', () => {
	it('keeps the team the entry names, without reading memberships', async () => {
		const { manager, find } = managerOver({
			memberships: [{ organizationTeamId: 'team-a' }, { organizationTeamId: 'team-b' }]
		});

		await expect(teamIdForEntry(manager, EMPLOYEE, { organizationTeamId: 'team-named' }, BOTH_ON)).resolves.toBe(
			'team-named'
		);
		expect(find).not.toHaveBeenCalled();
	});

	it.each([undefined, {}, { requireTeam: false }])(
		'leaves the team as sent, without reading memberships, when the switch is off (%p)',
		async (requirements) => {
			const { manager, find } = managerOver({ memberships: [{ organizationTeamId: 'team-a' }] });

			await expect(teamIdForEntry(manager, EMPLOYEE, {}, requirements)).resolves.toBeUndefined();
			await expect(
				teamIdForEntry(manager, EMPLOYEE, { organizationTeamId: null }, requirements)
			).resolves.toBeNull();
			expect(find).not.toHaveBeenCalled();
		}
	);

	it("fills the employee's only active team of the organization", async () => {
		const { manager, find } = managerOver({
			memberships: [
				{ organizationTeamId: 'team-only' },
				{ organizationTeamId: 'team-left', isActive: false },
				{ organizationTeamId: 'team-archived-membership', isArchived: true },
				{ organizationTeamId: 'team-archived', team: { isArchived: true } },
				{ organizationTeamId: 'team-inactive', team: { isActive: false } },
				{ organizationTeamId: 'team-deleted', team: { deletedAt: new Date() } },
				{
					organizationTeamId: 'team-elsewhere',
					organizationId: 'organization-2',
					team: { organizationId: 'organization-2' }
				},
				{ organizationTeamId: 'team-of-colleague', employeeId: 'employee-2' }
			]
		});

		await expect(teamIdForEntry(manager, EMPLOYEE, {}, { requireTeam: true })).resolves.toBe('team-only');
		expect(find).toHaveBeenCalledWith(OrganizationTeamEmployee, expect.anything());
	});

	it('counts a membership stored without a status as current', async () => {
		const { manager } = managerOver({
			memberships: [{ organizationTeamId: 'team-legacy', isActive: null, isArchived: null }]
		});

		await expect(teamIdForEntry(manager, EMPLOYEE, {}, { requireTeam: true })).resolves.toBe('team-legacy');
	});

	it('counts two memberships of one team as one team', async () => {
		const { manager } = managerOver({
			memberships: [{ organizationTeamId: 'team-twice' }, { organizationTeamId: 'team-twice' }]
		});

		await expect(teamIdForEntry(manager, EMPLOYEE, {}, { requireTeam: true })).resolves.toBe('team-twice');
	});

	it('fills nothing for an employee in several teams or in none', async () => {
		const several = managerOver({
			memberships: [{ organizationTeamId: 'team-a' }, { organizationTeamId: 'team-b' }]
		});
		const none = managerOver({});

		await expect(teamIdForEntry(several.manager, EMPLOYEE, {}, { requireTeam: true })).resolves.toBeNull();
		await expect(teamIdForEntry(none.manager, EMPLOYEE, {}, { requireTeam: true })).resolves.toBeNull();
	});
});

describe('projectIdForEntry', () => {
	const STORE: IStore = {
		tasks: [
			{ id: 'task-with-project', projectId: 'project-of-task', ...EMPLOYEE },
			{ id: 'task-without-project', projectId: null, ...EMPLOYEE },
			{ id: 'task-elsewhere', projectId: 'project-elsewhere', ...EMPLOYEE, organizationId: 'organization-2' }
		],
		teams: [
			{ id: 'team-with-default', defaultProjectId: 'project-of-team', ...EMPLOYEE },
			{ id: 'team-without-default', defaultProjectId: null, ...EMPLOYEE },
			{
				id: 'team-elsewhere',
				defaultProjectId: 'project-elsewhere',
				...EMPLOYEE,
				organizationId: 'organization-2'
			}
		]
	};
	const REQUIRED = { requireProject: true };

	it('keeps the project the entry names, without reading the task or the team', async () => {
		const { manager, findOne } = managerOver(STORE);
		const entry = {
			projectId: 'project-named',
			taskId: 'task-with-project',
			organizationTeamId: 'team-with-default'
		};

		await expect(projectIdForEntry(manager, EMPLOYEE, entry, BOTH_ON, true)).resolves.toBe('project-named');
		expect(findOne).not.toHaveBeenCalled();
	});

	it.each([undefined, { requireProject: false }])(
		'leaves the project as sent, without reading the task or the team, when the switch is off (%p)',
		async (requirements) => {
			const { manager, findOne } = managerOver(STORE);
			const entry = { taskId: 'task-with-project', organizationTeamId: 'team-with-default' };

			await expect(projectIdForEntry(manager, EMPLOYEE, entry, requirements, false)).resolves.toBeUndefined();
			expect(findOne).not.toHaveBeenCalled();
		}
	);

	it("takes the task's project first when the organization requires a project", async () => {
		const { manager, findOne } = managerOver(STORE);
		const entry = { taskId: 'task-with-project', organizationTeamId: 'team-with-default' };

		await expect(projectIdForEntry(manager, EMPLOYEE, entry, REQUIRED, false)).resolves.toBe('project-of-task');
		expect(findOne).toHaveBeenCalledTimes(1);
		expect(findOne).toHaveBeenCalledWith(Task, {
			where: { id: 'task-with-project', tenantId: EMPLOYEE.tenantId, organizationId: EMPLOYEE.organizationId },
			select: { id: true, projectId: true }
		});
	});

	it("takes the team's default project when the task gives none and a project is required", async () => {
		const { manager, findOne } = managerOver(STORE);
		const withoutTask = { organizationTeamId: 'team-with-default' };
		const taskWithoutProject = { taskId: 'task-without-project', organizationTeamId: 'team-with-default' };

		await expect(projectIdForEntry(manager, EMPLOYEE, withoutTask, REQUIRED, false)).resolves.toBe(
			'project-of-team'
		);
		await expect(projectIdForEntry(manager, EMPLOYEE, taskWithoutProject, REQUIRED, false)).resolves.toBe(
			'project-of-team'
		);
		expect(findOne).toHaveBeenCalledWith(OrganizationTeam, {
			where: { id: 'team-with-default', tenantId: EMPLOYEE.tenantId, organizationId: EMPLOYEE.organizationId },
			select: { id: true, defaultProjectId: true }
		});
	});

	it("takes the task's project for a client that always files under it, and never the team's default then", async () => {
		const { manager, findOne } = managerOver(STORE);
		const taskWithoutProject = { taskId: 'task-without-project', organizationTeamId: 'team-with-default' };

		await expect(
			projectIdForEntry(manager, EMPLOYEE, { taskId: 'task-with-project' }, undefined, true)
		).resolves.toBe('project-of-task');
		await expect(projectIdForEntry(manager, EMPLOYEE, taskWithoutProject, undefined, true)).resolves.toBeNull();
		expect(findOne).not.toHaveBeenCalledWith(OrganizationTeam, expect.anything());
	});

	it("fills nothing without a task or a team default, nor from another organization's task or team", async () => {
		const { manager } = managerOver(STORE);
		const teamWithoutDefault = { organizationTeamId: 'team-without-default' };
		const elsewhere = { taskId: 'task-elsewhere', organizationTeamId: 'team-elsewhere' };

		await expect(projectIdForEntry(manager, EMPLOYEE, {}, REQUIRED, false)).resolves.toBeNull();
		await expect(projectIdForEntry(manager, EMPLOYEE, teamWithoutDefault, REQUIRED, false)).resolves.toBeNull();
		await expect(projectIdForEntry(manager, EMPLOYEE, elsewhere, REQUIRED, false)).resolves.toBeNull();
	});
});
