import { Injectable } from '@nestjs/common';
import { DataSource, In, IsNull } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { Employee, Tag, Task, TaskPriority, TaskStatus } from '@gauzy/core';
import { TaskAutomationRun } from '../entities/task-automation-run.entity';
import {
	ITaskAutomationCatalog,
	ITaskAutomationChildSnapshot,
	ITaskAutomationPriorityRow,
	ITaskAutomationStatusRow,
	ITaskAutomationTaskSnapshot
} from '../engine/task-snapshot';

const ids = (rows: Array<{ id?: string | null }> | null | undefined): ID[] =>
	[...new Set((rows ?? []).map((row) => row?.id).filter((id): id is string => !!id))];

/**
 * What the engine reads of the platform: a task as a rule tests it (re-read before each rule, so each rule sees what
 * the rules before it left), its sub-tasks for the parent triggers, and the organization's statuses and priorities.
 * Reads go through TypeORM's `DataSource`, scoped by tenant; writes never happen here.
 */
@Injectable()
export class TaskAutomationTaskReader {
	constructor(private readonly dataSource: DataSource) {}

	/** A task of the tenant (not deleted), or `null`. */
	async snapshot(tenantId: ID, taskId: ID, options: { children?: boolean } = {}): Promise<ITaskAutomationTaskSnapshot | null> {
		const task = await this.dataSource.getRepository(Task).findOne({
			where: { id: taskId, tenantId } as never,
			relations: { members: true, tags: true, teams: true } as never
		});
		if (!task || !task.organizationId) return null;
		const snapshot: ITaskAutomationTaskSnapshot = {
			id: task.id as ID,
			tenantId: task.tenantId as ID,
			organizationId: task.organizationId as ID,
			projectId: (task.projectId as ID) ?? null,
			teamIds: ids(task.teams as Array<{ id?: string }>),
			title: task.title ?? '',
			status: (task.status as string) ?? null,
			taskStatusId: (task.taskStatusId as ID) ?? null,
			priority: (task.priority as string) ?? null,
			taskPriorityId: (task.taskPriorityId as ID) ?? null,
			memberIds: ids(task.members as Array<{ id?: string }>),
			tagIds: ids(task.tags as Array<{ id?: string }>),
			parentId: (task.parentId as ID) ?? null,
			dueDate: task.dueDate ? new Date(task.dueDate) : null,
			reference: task.prefix && task.number !== null && task.number !== undefined ? `${task.prefix}-${task.number}` : null
		};
		if (options.children) snapshot.children = await this.children(tenantId, snapshot.id);
		return snapshot;
	}

	/** Whether a task (not deleted) is of the tenant and the organization: a closed link is reported only for one. */
	async belongsTo(tenantId: ID, organizationId: ID, taskId: ID): Promise<boolean> {
		const count = await this.dataSource.getRepository(Task).count({ where: { id: taskId, tenantId, organizationId } as never });
		return count > 0;
	}

	/**
	 * A task's assignees and labels as stored now, or `null` when the task is gone: what the writer applies a rule's
	 * additions and removals to, read just before it writes.
	 */
	async lists(tenantId: ID, taskId: ID): Promise<{ memberIds: ID[]; tagIds: ID[] } | null> {
		const task = await this.dataSource.getRepository(Task).findOne({
			where: { id: taskId, tenantId } as never,
			relations: { members: true, tags: true } as never,
			select: { id: true, members: { id: true }, tags: { id: true } } as never
		});
		if (!task) return null;
		return { memberIds: ids(task.members as Array<{ id?: string }>), tagIds: ids(task.tags as Array<{ id?: string }>) };
	}

	/** The sub-tasks of a task (not deleted). */
	async children(tenantId: ID, parentId: ID): Promise<ITaskAutomationChildSnapshot[]> {
		const rows = await this.dataSource.getRepository(Task).find({
			where: { parentId, tenantId } as never,
			select: { id: true, status: true, taskStatusId: true, projectId: true } as never
		});
		return rows.map((row) => ({
			id: row.id as ID,
			status: (row.status as string) ?? null,
			taskStatusId: (row.taskStatusId as ID) ?? null,
			projectId: (row.projectId as ID) ?? null
		}));
	}

	/**
	 * The organization's statuses and priorities (its own and the tenant-wide ones), and which of the people and labels
	 * a rule names are the organization's.
	 */
	async catalog(tenantId: ID, organizationId: ID, named: { employeeIds?: ID[]; tagIds?: ID[] } = {}): Promise<ITaskAutomationCatalog> {
		const scoped = [
			{ tenantId, organizationId },
			{ tenantId, organizationId: IsNull() }
		] as never;
		const [statuses, priorities] = await Promise.all([
			this.dataSource.getRepository(TaskStatus).find({ where: scoped }),
			this.dataSource.getRepository(TaskPriority).find({ where: scoped })
		]);
		const catalog: ITaskAutomationCatalog = {
			statuses: statuses.map(
				(row): ITaskAutomationStatusRow => ({
					id: row.id as ID,
					value: row.value ?? null,
					name: row.name ?? null,
					projectId: (row.projectId as ID) ?? null,
					order: row.order ?? null,
					isTodo: row.isTodo ?? null,
					isInProgress: row.isInProgress ?? null,
					isDone: row.isDone ?? null
				})
			),
			priorities: priorities.map(
				(row): ITaskAutomationPriorityRow => ({
					id: row.id as ID,
					value: row.value ?? null,
					name: row.name ?? null,
					projectId: (row.projectId as ID) ?? null
				})
			)
		};
		const employeeIds = [...new Set(named.employeeIds ?? [])];
		if (employeeIds.length) {
			const rows = await this.dataSource.getRepository(Employee).find({
				where: { id: In(employeeIds), tenantId, organizationId } as never,
				select: { id: true } as never
			});
			catalog.employeeIds = new Set(rows.map((row) => String(row.id)));
		}
		const tagIds = [...new Set(named.tagIds ?? [])];
		if (tagIds.length) {
			const rows = await this.dataSource.getRepository(Tag).find({
				where: [
					{ id: In(tagIds), tenantId, organizationId },
					{ id: In(tagIds), tenantId, organizationId: IsNull() }
				] as never,
				select: { id: true } as never
			});
			catalog.tagIds = new Set(rows.map((row) => String(row.id)));
		}
		return catalog;
	}

	/** The users of employees (an Inbox notice is addressed to users), skipping employees without one. */
	async userIdsOfEmployees(tenantId: ID, employeeIds: ID[]): Promise<Map<ID, ID>> {
		const unique = [...new Set(employeeIds)];
		if (!unique.length) return new Map();
		const rows = await this.dataSource.getRepository(Employee).find({
			where: { id: In(unique), tenantId } as never,
			select: { id: true, userId: true } as never
		});
		return new Map(rows.filter((row) => !!row.userId).map((row) => [row.id as ID, row.userId as ID]));
	}

	/**
	 * Open tasks whose due date passed in a window (the due-date sweep), of the rule's organization and scope, oldest
	 * due first (then by id), one page at a time: `after` is the last task of the previous page. "Open" is decided by
	 * the engine on each task; this only leaves out what is certainly closed, and — with `ruleId` — the tasks that rule
	 * already reported for their current due date, so tasks that stay open after their notice never fill the pages. A
	 * task counts as reported when a finished run of the rule for it was made at or after its due date and finished at
	 * or after the task's last change: a due date corrected after the notice (a change of the task) brings the task
	 * back, and the run's exact key (`finishedKeys`) decides. This only narrows the read; the key is always checked.
	 */
	async dueTasks(
		scope: { tenantId: ID; organizationId: ID; projectId?: ID | null; organizationTeamId?: ID | null; ruleId?: ID | null },
		window: { after: Date; until: Date },
		limit: number,
		after: { id: ID; dueDate: Date } | null = null
	): Promise<Array<{ id: ID; dueDate: Date }>> {
		const query = this.dataSource
			.getRepository(Task)
			.createQueryBuilder('task')
			.select(['task.id', 'task.dueDate'])
			.where('task.tenantId = :tenantId', { tenantId: scope.tenantId })
			.andWhere('task.organizationId = :organizationId', { organizationId: scope.organizationId })
			.andWhere('task.dueDate IS NOT NULL')
			.andWhere('task.dueDate > :after', { after: window.after })
			.andWhere('task.dueDate <= :until', { until: window.until })
			.andWhere('(task.status IS NULL OR LOWER(task.status) NOT IN (:...closed))', {
				closed: ['done', 'completed', 'closed', 'cancelled', 'canceled']
			})
			.orderBy('task.dueDate', 'ASC')
			.addOrderBy('task.id', 'ASC')
			.take(limit);
		if (after) {
			query.andWhere('(task.dueDate > :cursorDue OR (task.dueDate = :cursorDue AND task.id > :cursorId))', {
				cursorDue: after.dueDate,
				cursorId: after.id
			});
		}
		if (scope.ruleId) {
			const reported = query
				.subQuery()
				.select('1')
				.from(TaskAutomationRun, 'run')
				.where('run.ruleId = :ruleId')
				.andWhere('run.taskId = task.id')
				.andWhere('run.createdAt >= task.dueDate')
				.andWhere('run.updatedAt >= task.updatedAt')
				.andWhere('run.outcome <> :runningOutcome')
				.getQuery();
			query.andWhere(`NOT EXISTS ${reported}`, { ruleId: scope.ruleId, runningOutcome: 'RUNNING' });
		}
		if (scope.projectId) query.andWhere('task.projectId = :projectId', { projectId: scope.projectId });
		if (scope.organizationTeamId) {
			query.innerJoin('task.teams', 'team', 'team.id = :teamId', { teamId: scope.organizationTeamId });
		}
		const rows = await query.getMany();
		return rows.filter((row) => !!row.dueDate).map((row) => ({ id: row.id as ID, dueDate: new Date(row.dueDate as Date) }));
	}
}
