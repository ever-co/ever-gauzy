import { EntityManager, FindOneOptions, In } from 'typeorm';
import { ActorTypeEnum, BaseEntityEnum, ID, ITimeLog } from '@gauzy/contracts';
import { isBetterSqlite3, isSqlite } from '@gauzy/config';
import { ActivityLog } from '../../activity-log/activity-log.entity';
import { generateActivityLogDescription, serializeActivityLogForSqlite } from '../../activity-log/activity-log.helper';
import { RequestContext } from '../../core/context';
import {
	Employee,
	OrganizationContact,
	OrganizationProject,
	OrganizationTeam,
	Task
} from '../../core/entities/internal';
import { referencedEntities, referencedIds, TimeLogHistoryChange, TimeLogReferenceField } from './time-log-history';

/**
 * Asks a time log command to record the change in the entry's history. Only the routes through which a person
 * changes an entry pass it (manual add, edit, delete): what the timer, a tracker or an integration writes on its
 * own records nothing.
 */
export interface TimeLogHistoryOptions {
	/** The reason the person gave, when the route takes one. */
	reason?: string | null;
}

/** The entry a change belongs to: its id, owner and scope, and what names it in the row's description. */
export interface TimeLogHistorySubject {
	id: ID;
	employeeId: ID;
	organizationId?: ID;
	tenantId?: ID;
	taskId?: ID | null;
	projectId?: ID | null;
}

/**
 * The subject of a history row, read from a time log.
 *
 * @param timeLog The entry (as stored, or with its change applied).
 */
export function historySubject(
	timeLog: Pick<ITimeLog, 'id' | 'employeeId' | 'organizationId' | 'tenantId' | 'taskId' | 'projectId'>
): TimeLogHistorySubject {
	return {
		id: timeLog.id,
		employeeId: timeLog.employeeId,
		organizationId: timeLog.organizationId,
		tenantId: timeLog.tenantId,
		taskId: timeLog.taskId,
		projectId: timeLog.projectId
	};
}

/** One change to record, with the entry it belongs to. */
export interface TimeLogHistoryRecord {
	subject: TimeLogHistorySubject;
	change: TimeLogHistoryChange;
	reason?: string | null;
}

/** The label of an entry in a row's description: its task, else its project, else "time entry". */
function subjectLabel(subject: TimeLogHistorySubject, names: ReadonlyMap<ID, string>): string {
	const taskName = subject.taskId ? names.get(subject.taskId) : undefined;
	const projectName = subject.projectId ? names.get(subject.projectId) : undefined;
	return taskName ?? projectName ?? 'time entry';
}

/**
 * The name of every record the changes point at (tasks, projects, clients, teams, members), read once per table
 * through `manager` (inside the caller's transaction), deleted records included: the history must stay readable
 * after a task is removed.
 *
 * @param manager The entity manager of the write.
 * @param ids The ids per reference field.
 * @param tenantId The tenant of the entries.
 */
export async function loadReferenceNames(
	manager: EntityManager,
	ids: ReadonlyMap<TimeLogReferenceField, ReadonlySet<ID>>,
	tenantId: ID
): Promise<Map<ID, string>> {
	const names = new Map<ID, string>();
	const listOf = (field: TimeLogReferenceField): ID[] => [...(ids.get(field) ?? new Set<ID>())];

	const taskIds = listOf('taskId');
	if (taskIds.length > 0) {
		const tasks = await manager.find(Task, {
			where: { id: In(taskIds), tenantId },
			select: { id: true, title: true },
			withDeleted: true
		});
		tasks.forEach((task) => names.set(task.id, task.title));
	}

	const projectIds = listOf('projectId');
	if (projectIds.length > 0) {
		const projects = await manager.find(OrganizationProject, {
			where: { id: In(projectIds), tenantId },
			select: { id: true, name: true },
			withDeleted: true
		});
		projects.forEach((project) => names.set(project.id, project.name));
	}

	const contactIds = listOf('organizationContactId');
	if (contactIds.length > 0) {
		const contacts = await manager.find(OrganizationContact, {
			where: { id: In(contactIds), tenantId },
			select: { id: true, name: true },
			withDeleted: true
		});
		contacts.forEach((contact) => names.set(contact.id, contact.name));
	}

	const teamIds = listOf('organizationTeamId');
	if (teamIds.length > 0) {
		const teams = await manager.find(OrganizationTeam, {
			where: { id: In(teamIds), tenantId },
			select: { id: true, name: true },
			withDeleted: true
		});
		teams.forEach((team) => names.set(team.id, team.name));
	}

	const employeeIds = listOf('employeeId');
	if (employeeIds.length > 0) {
		const employees = await manager.find(Employee, {
			where: { id: In(employeeIds), tenantId },
			relations: { user: true },
			select: { id: true, user: { id: true, firstName: true, lastName: true } },
			withDeleted: true
		});
		employees.forEach((employee) => {
			const fullName = [employee.user?.firstName, employee.user?.lastName].filter(Boolean).join(' ');
			names.set(employee.id, fullName);
		});
	}

	return names;
}

/**
 * Writes the history rows of some entry changes (activity log rows whose entity is `TimeLog`) through `manager`,
 * so that a caller inside a transaction writes them with the change itself. The author is the signed-in user
 * (`createdByUserId`, filled on insert) and their employee when they have one; the entry's owner and the reason
 * are kept in `data`.
 *
 * @param manager The entity manager of the write (a transaction's, when the change runs in one).
 * @param records The changes to record; nothing is written for an empty list.
 */
export async function recordTimeLogHistory(
	manager: EntityManager,
	records: readonly TimeLogHistoryRecord[]
): Promise<void> {
	if (records.length === 0) {
		return;
	}
	const tenantId = records[0].subject.tenantId ?? RequestContext.currentTenantId();
	const ids = referencedIds(records.map((record) => record.change));
	for (const record of records) {
		if (record.subject.taskId) {
			ids.get('taskId').add(record.subject.taskId);
		}
		if (record.subject.projectId) {
			ids.get('projectId').add(record.subject.projectId);
		}
	}
	const names = await loadReferenceNames(manager, ids, tenantId);
	const authorEmployeeId = RequestContext.currentEmployeeId() ?? RequestContext.currentUser()?.employeeId ?? null;

	const rows = records.map(({ subject, change, reason }) => {
		let row: Record<string, unknown> = {
			entity: BaseEntityEnum.TimeLog,
			entityId: subject.id,
			action: change.action,
			actorType: ActorTypeEnum.User,
			description: generateActivityLogDescription(
				change.action,
				BaseEntityEnum.TimeLog,
				subjectLabel(subject, names)
			),
			updatedFields: change.updatedFields,
			previousValues: change.previousValues,
			updatedValues: change.updatedValues,
			previousEntities: referencedEntities(change.previousValues, names),
			updatedEntities: referencedEntities(change.updatedValues, names),
			data: { employeeId: subject.employeeId, reason: reason ?? null },
			employeeId: authorEmployeeId,
			organizationId: subject.organizationId,
			tenantId: subject.tenantId ?? tenantId
		};
		if (isSqlite() || isBetterSqlite3()) {
			// SQLite stores these JSON fields as text, and the subscriber leaves the changed fields as an array.
			row = serializeActivityLogForSqlite(row);
		}
		return manager.create(ActivityLog, row);
	});
	await manager.save(ActivityLog, rows);
}

/**
 * The lock a change takes on the rows it reads its values before from, held until its transaction ends, so no other
 * change comes between that read and its write. None on SQLite, which has no row lock (TypeORM refuses one there).
 */
export function lockedForChange(): Pick<FindOneOptions, 'lock'> {
	if (isSqlite() || isBetterSqlite3()) {
		return {};
	}
	return { lock: { mode: 'pessimistic_write' } };
}
