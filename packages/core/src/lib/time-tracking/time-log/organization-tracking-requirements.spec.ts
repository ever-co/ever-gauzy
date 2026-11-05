// Must stay first: see timer.service.spec.ts.
import '../../core/entities/internal';

import { BadRequestException } from '@nestjs/common';
import { EntityManager, FindOperator } from 'typeorm';
import { OrganizationTeamEmployee, Task } from '../../core/entities/internal';
import {
	ITrackingRequirements,
	TRACKING_FIELD_REQUIRED,
	assertRequiredContext,
	projectIdForEntry,
	teamIdForEntry
} from './organization-tracking-requirements';

/**
 * An organization can require a team, a project, a task, a client and a description on every time entry. The
 * switches are all off by default and an entry is then accepted as sent. When one is on, the team and the project
 * are filled where the server can tell them, and an entry still missing a required field is refused with a 400
 * naming every missing field.
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

/** A manager over stored memberships and tasks that answers lookups the way the database would. */
function managerOver(memberships: IStoredMembership[], tasks: Record<string, unknown>[] = []) {
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
	const findOne = jest.fn(async (_entity: unknown, { where }: { where: Record<string, unknown> }) => {
		return tasks.find((task) => matchesWhere(task, where)) ?? null;
	});
	return { manager: { find, findOne } as unknown as EntityManager, find, findOne };
}

const ALL_ON: ITrackingRequirements = {
	requireTeam: true,
	requireProject: true,
	requireTask: true,
	requireClient: true,
	requireDescription: true
};

const COMPLETE_ENTRY = {
	organizationTeamId: 'team-1',
	projectId: 'project-1',
	taskId: 'task-1',
	organizationContactId: 'client-1',
	description: 'Fixing the invoice export'
};

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
	it.each([undefined, {}, { requireReason: true } as ITrackingRequirements])(
		'accepts an empty entry when no switch is on (%p)',
		(requirements) => {
			expect(refusalOf(requirements, {})).toBeUndefined();
		}
	);

	it.each([
		['requireTeam', 'organizationTeamId', 'a team'],
		['requireProject', 'projectId', 'a project'],
		['requireTask', 'taskId', 'a task'],
		['requireClient', 'organizationContactId', 'a client'],
		['requireDescription', 'description', 'a description']
	])('refuses with a 400 naming the field when %s is on and %s is missing', (requirement, field, label) => {
		const requirements = { [requirement]: true } as ITrackingRequirements;
		const entry = { ...COMPLETE_ENTRY, [field]: undefined };

		expect(refusalOf(requirements, entry)).toEqual({
			message: `Your organization requires ${label} on every time entry. Add it and try again.`,
			code: TRACKING_FIELD_REQUIRED,
			fields: [field]
		});
		expect(refusalOf(requirements, COMPLETE_ENTRY)).toBeUndefined();
		expect(refusalOf({ [requirement]: false } as ITrackingRequirements, entry)).toBeUndefined();
	});

	it('names every missing field in one refusal', () => {
		expect(refusalOf(ALL_ON, { taskId: 'task-1' })).toEqual({
			message:
				'Your organization requires a team, a project, a client and a description on every time entry. Add them and try again.',
			code: TRACKING_FIELD_REQUIRED,
			fields: ['organizationTeamId', 'projectId', 'organizationContactId', 'description']
		});
	});

	it.each([null, '', '   '])('counts a description of %p as missing', (description) => {
		const refusal = refusalOf({ requireDescription: true }, { description });

		expect(refusal?.fields).toEqual(['description']);
	});
});

describe('teamIdForEntry', () => {
	it('keeps the team the entry names, without reading memberships', async () => {
		const { manager, find } = managerOver([{ organizationTeamId: 'team-a' }, { organizationTeamId: 'team-b' }]);

		await expect(teamIdForEntry(manager, EMPLOYEE, { organizationTeamId: 'team-named' }, ALL_ON)).resolves.toBe(
			'team-named'
		);
		expect(find).not.toHaveBeenCalled();
	});

	it.each([undefined, {}, { requireTeam: false }])(
		'leaves the team as sent, without reading memberships, when the switch is off (%p)',
		async (requirements) => {
			const { manager, find } = managerOver([{ organizationTeamId: 'team-a' }]);

			await expect(teamIdForEntry(manager, EMPLOYEE, {}, requirements)).resolves.toBeUndefined();
			await expect(
				teamIdForEntry(manager, EMPLOYEE, { organizationTeamId: null }, requirements)
			).resolves.toBeNull();
			expect(find).not.toHaveBeenCalled();
		}
	);

	it("fills the employee's only active team of the organization", async () => {
		const { manager, find } = managerOver([
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
		]);

		await expect(teamIdForEntry(manager, EMPLOYEE, {}, { requireTeam: true })).resolves.toBe('team-only');
		expect(find).toHaveBeenCalledWith(OrganizationTeamEmployee, expect.anything());
	});

	it('counts a membership stored without a status as current', async () => {
		const { manager } = managerOver([{ organizationTeamId: 'team-legacy', isActive: null, isArchived: null }]);

		await expect(teamIdForEntry(manager, EMPLOYEE, {}, { requireTeam: true })).resolves.toBe('team-legacy');
	});

	it('counts two memberships of one team as one team', async () => {
		const { manager } = managerOver([{ organizationTeamId: 'team-twice' }, { organizationTeamId: 'team-twice' }]);

		await expect(teamIdForEntry(manager, EMPLOYEE, {}, { requireTeam: true })).resolves.toBe('team-twice');
	});

	it('fills nothing for an employee in several teams or in none', async () => {
		const several = managerOver([{ organizationTeamId: 'team-a' }, { organizationTeamId: 'team-b' }]);
		const none = managerOver([]);

		await expect(teamIdForEntry(several.manager, EMPLOYEE, {}, { requireTeam: true })).resolves.toBeNull();
		await expect(teamIdForEntry(none.manager, EMPLOYEE, {}, { requireTeam: true })).resolves.toBeNull();
	});
});

describe('projectIdForEntry', () => {
	const TASKS = [
		{ id: 'task-with-project', projectId: 'project-of-task', ...EMPLOYEE },
		{ id: 'task-without-project', projectId: null, ...EMPLOYEE },
		{ id: 'task-elsewhere', projectId: 'project-elsewhere', ...EMPLOYEE, organizationId: 'organization-2' }
	];

	it('keeps the project the entry names, without reading the task', async () => {
		const { manager, findOne } = managerOver([], TASKS);
		const entry = { projectId: 'project-named', taskId: 'task-with-project' };

		await expect(projectIdForEntry(manager, EMPLOYEE, entry, ALL_ON, true)).resolves.toBe('project-named');
		expect(findOne).not.toHaveBeenCalled();
	});

	it.each([undefined, { requireProject: false }])(
		'leaves the project as sent, without reading the task, when the switch is off (%p)',
		async (requirements) => {
			const { manager, findOne } = managerOver([], TASKS);

			await expect(
				projectIdForEntry(manager, EMPLOYEE, { taskId: 'task-with-project' }, requirements, false)
			).resolves.toBeUndefined();
			expect(findOne).not.toHaveBeenCalled();
		}
	);

	it("takes the task's project when the organization requires a project", async () => {
		const { manager, findOne } = managerOver([], TASKS);

		await expect(
			projectIdForEntry(manager, EMPLOYEE, { taskId: 'task-with-project' }, { requireProject: true }, false)
		).resolves.toBe('project-of-task');
		expect(findOne).toHaveBeenCalledWith(Task, {
			where: { id: 'task-with-project', tenantId: EMPLOYEE.tenantId, organizationId: EMPLOYEE.organizationId },
			select: { id: true, projectId: true }
		});
	});

	it("takes the task's project for a client that always files under it, whatever the switch", async () => {
		const { manager } = managerOver([], TASKS);

		await expect(
			projectIdForEntry(manager, EMPLOYEE, { taskId: 'task-with-project' }, undefined, true)
		).resolves.toBe('project-of-task');
	});

	it("fills nothing without a task, for a task without a project, or for another organization's task", async () => {
		const { manager } = managerOver([], TASKS);
		const requirements = { requireProject: true };

		await expect(projectIdForEntry(manager, EMPLOYEE, {}, requirements, false)).resolves.toBeNull();
		await expect(
			projectIdForEntry(manager, EMPLOYEE, { taskId: 'task-without-project' }, requirements, false)
		).resolves.toBeNull();
		await expect(
			projectIdForEntry(manager, EMPLOYEE, { taskId: 'task-elsewhere' }, requirements, false)
		).resolves.toBeNull();
	});
});
