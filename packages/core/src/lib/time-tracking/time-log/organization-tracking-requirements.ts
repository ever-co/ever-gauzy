import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ID, IManualTimeInput, IOrganization } from '@gauzy/contracts';
import { OrganizationTeam, OrganizationTeamEmployee, Task } from '../../core/entities/internal';
import { activeGroupWhere, activeMembershipWhere } from '../../employee/managed-employee.service';

/** The code of the refusal of a time entry that misses what its organization requires. */
export const TRACKING_FIELD_REQUIRED = 'TRACKING_FIELD_REQUIRED';

/**
 * The organization switches the server holds every time entry to. Both are off by default. The other `require*`
 * switches (task, client, description, reason) stay with the clients that check them.
 */
export type ITrackingRequirements = Pick<IOrganization, 'requireTeam' | 'requireProject'>;

/** What a time entry is filed under. */
export interface ITrackedContext {
	organizationTeamId?: ID | null;
	projectId?: ID | null;
	taskId?: ID | null;
}

/** A manual time entry, and whether a tracker uploaded it (see `CreateManualTimeLogDTO.uploadedByTracker`). */
export type IManualTimeEntry = IManualTimeInput & { uploadedByTracker?: boolean };

/** The employee a time entry is recorded for. */
export interface ITrackedEmployee {
	employeeId: ID;
	organizationId: ID;
	tenantId: ID;
}

interface IRequiredField {
	field: keyof ITrackedContext;
	label: string;
	requirement: keyof ITrackingRequirements;
}

/** Each field a switch requires, in the order a refusal lists them. */
const REQUIRED_FIELDS: ReadonlyArray<IRequiredField> = [
	{ field: 'organizationTeamId', label: 'a team', requirement: 'requireTeam' },
	{ field: 'projectId', label: 'a project', requirement: 'requireProject' }
];

/**
 * The team a time entry is filed under: the one it names or, when the organization requires a team and the entry
 * names none, the employee's only active team of the organization. An employee in several teams or in none gets no
 * team, and `assertRequiredContext` refuses the entry.
 *
 * @param manager Reads the employee's memberships.
 * @param employee The employee the entry is for.
 * @param context The entry as sent.
 * @param requirements The organization's switches.
 * @returns The team, or what the entry named when nothing is filled.
 */
export async function teamIdForEntry(
	manager: EntityManager,
	employee: ITrackedEmployee,
	context: ITrackedContext,
	requirements: ITrackingRequirements | undefined
): Promise<ID | null | undefined> {
	const namedTeamId = context.organizationTeamId;
	if (namedTeamId) {
		return namedTeamId;
	}
	const requiresTeam = requirements?.requireTeam === true;
	if (!requiresTeam) {
		return namedTeamId;
	}
	return await soleActiveTeamIdOf(manager, employee);
}

/**
 * The project a time entry is filed under: the one it names or, when it names none, its task's project if the
 * organization requires a project or the client always files under it (`takesTaskProject`). When a project is
 * required and the task gives none, the default project of the entry's team.
 *
 * @param manager Reads the task and the team.
 * @param employee The employee the entry is for; the task and the team are read in their organization.
 * @param context The entry, with its team already filled.
 * @param requirements The organization's switches.
 * @param takesTaskProject Whether the entry takes its task's project even when no switch asks for a project.
 * @returns The project, or what the entry named when nothing is filled.
 */
export async function projectIdForEntry(
	manager: EntityManager,
	employee: ITrackedEmployee,
	context: ITrackedContext,
	requirements: ITrackingRequirements | undefined,
	takesTaskProject: boolean
): Promise<ID | null | undefined> {
	const { projectId, taskId, organizationTeamId } = context;
	if (projectId) {
		return projectId;
	}
	const requiresProject = requirements?.requireProject === true;
	const fillsFromTask = takesTaskProject || requiresProject;
	if (!fillsFromTask) {
		return projectId;
	}
	const taskProjectId = await projectIdOfTask(manager, employee, taskId);
	if (taskProjectId) {
		return taskProjectId;
	}
	if (!requiresProject) {
		return null;
	}
	return await defaultProjectIdOfTeam(manager, employee, organizationTeamId);
}

/**
 * Refuses a time entry that misses a field its organization requires, naming every missing field. An organization
 * with both switches off accepts any entry.
 *
 * @param requirements The organization's switches.
 * @param context The entry, with the team and project already filled where they could be.
 * @throws BadRequestException with the code TRACKING_FIELD_REQUIRED and the missing request fields.
 */
export function assertRequiredContext(requirements: ITrackingRequirements | undefined, context: ITrackedContext): void {
	const missing = REQUIRED_FIELDS.filter((rule) => isRequiredAndMissing(rule, requirements, context));
	if (missing.length === 0) {
		return;
	}
	const labels = missing.map((rule) => rule.label);
	const fields = missing.map((rule) => rule.field);
	const required = labels.join(' and ');
	const pronoun = pronounFor(labels);
	const message = `Your organization requires ${required} on every time entry. Add ${pronoun} and try again.`;
	throw new BadRequestException({ message, code: TRACKING_FIELD_REQUIRED, fields });
}

/**
 * The employee's only active team of the organization, or null when they are in several or in none. A membership
 * or a team that is inactive, archived or deleted does not count.
 */
async function soleActiveTeamIdOf(manager: EntityManager, employee: ITrackedEmployee): Promise<ID | null> {
	const { employeeId, organizationId, tenantId } = employee;
	const memberships = await manager.find(OrganizationTeamEmployee, {
		select: { id: true, organizationTeamId: true },
		where: {
			employeeId,
			organizationId,
			tenantId,
			...activeMembershipWhere(),
			organizationTeam: { ...activeGroupWhere(), organizationId, tenantId }
		}
	});
	const teamIds = new Set(memberships.map((membership) => membership.organizationTeamId));
	if (teamIds.size !== 1) {
		return null;
	}
	const [teamId] = teamIds;
	return teamId;
}

/** The project of the entry's task, or null without a task or for a task without a project. */
async function projectIdOfTask(
	manager: EntityManager,
	employee: ITrackedEmployee,
	taskId: ID | null | undefined
): Promise<ID | null> {
	if (!taskId) {
		return null;
	}
	const { organizationId, tenantId } = employee;
	const task = await manager.findOne(Task, {
		where: { id: taskId, tenantId, organizationId },
		select: { id: true, projectId: true }
	});
	return task?.projectId ?? null;
}

/** The default project of the entry's team, or null without a team or for a team without one. */
async function defaultProjectIdOfTeam(
	manager: EntityManager,
	employee: ITrackedEmployee,
	organizationTeamId: ID | null | undefined
): Promise<ID | null> {
	if (!organizationTeamId) {
		return null;
	}
	const { organizationId, tenantId } = employee;
	const team = await manager.findOne(OrganizationTeam, {
		where: { id: organizationTeamId, tenantId, organizationId },
		select: { id: true, defaultProjectId: true }
	});
	return team?.defaultProjectId ?? null;
}

/** Whether the organization requires the field and the entry leaves it empty. */
function isRequiredAndMissing(
	rule: IRequiredField,
	requirements: ITrackingRequirements | undefined,
	context: ITrackedContext
): boolean {
	const isRequired = requirements?.[rule.requirement] === true;
	if (!isRequired) {
		return false;
	}
	const value = context[rule.field];
	return !value;
}

/** The word that refers back to the listed labels. */
function pronounFor(labels: ReadonlyArray<string>): string {
	if (labels.length === 1) {
		return 'it';
	}
	return 'them';
}
