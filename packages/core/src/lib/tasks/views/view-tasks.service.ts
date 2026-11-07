import { BadRequestException, Injectable } from '@nestjs/common';
import { Brackets, DataSource, FindOptionsRelations, In, ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import {
	ID,
	ITask,
	ITaskViewFilterCondition,
	ITaskViewFilterGroup,
	ITaskViewGroupCount,
	ITaskViewInvalidFilter,
	ITaskViewOrdering,
	ITaskViewTasksPage,
	ITaskViewTasksQuery,
	TaskViewGroupBy
} from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { BUILT_IN_VIEW_DEFAULT_RELATIONS, BUILT_IN_VIEW_RELATIONS, relationsTreeOf } from '../built-in-views';
import { Task } from '../task.entity';
import { TaskView } from './view.entity';
import { TaskViewService } from './view.service';
import {
	decodeCursor,
	encodeCursor,
	filterOptionsOf,
	groupingOf,
	isFilterGroup,
	IViewCursor,
	orderingOf,
	pageLimitOf,
	relativeWindow,
	TASK_VIEW_MANUAL_ORDER_MAX,
	validateFilterTree
} from './view-filters';

/** The column a record field compares, or the join table and column a membership field reads. */
const RECORD_COLUMNS: Readonly<Record<string, string>> = {
	status: 'taskStatusId',
	priority: 'taskPriorityId',
	size: 'taskSizeId',
	project: 'projectId',
	sprint: 'organizationSprintId'
};
const MEMBERSHIPS: Readonly<Record<string, { table: string; column: string }>> = {
	labels: { table: 'tag_task', column: 'tagId' },
	assignees: { table: 'task_employee', column: 'employeeId' },
	team: { table: 'task_team', column: 'organizationTeamId' }
};
/** The entity a field's ids name, for the check that they still exist and for the groups' names. */
const REFERENCES: Readonly<Record<string, string>> = {
	status: 'TaskStatus',
	priority: 'TaskPriority',
	size: 'TaskSize',
	project: 'OrganizationProject',
	sprint: 'OrganizationSprint',
	labels: 'Tag',
	assignees: 'Employee',
	team: 'OrganizationTeam'
};
const GROUP_FIELDS: Readonly<Record<string, string>> = { status: 'status', priority: 'priority', size: 'size', project: 'project', sprint: 'sprint', assignee: 'assignees', team: 'team', label: 'labels' };
/** A due date that is not set sorts last: compared as this instant. */
const FAR_FUTURE = '9999-12-31T00:00:00.000Z';

/**
 * The tasks of a saved view (FR-3): the view's filter tree (or the query's, an unsaved edit of it) over the tasks
 * the caller may list, with cursor pagination, the counts per group, relative dates resolved in the caller's time
 * zone, and the conditions the platform could not apply reported rather than failing the request — a filter on a
 * deleted label is listed as invalid and the page is served without it.
 */
@Injectable()
export class TaskViewTasksService {
	constructor(private readonly dataSource: DataSource, private readonly views: TaskViewService) {}

	async tasksOf(viewId: ID, query: ITaskViewTasksQuery = {}, now = new Date()): Promise<ITaskViewTasksPage> {
		const view = await this.views.findOneByIdString(viewId);
		const tenantId = RequestContext.currentTenantId() as ID;
		const organizationId = (query.organizationId ?? view.organizationId) as ID;
		const options = filterOptionsOf(view.filterOptions);
		const validated = validateFilterTree(query.filter !== undefined ? query.filter : options.filter ?? null);
		const invalid: ITaskViewInvalidFilter[] = [...validated.invalid];
		const tree = validated.tree ? await this.withoutDeletedReferences(validated.tree, tenantId, 'filter', invalid) : null;
		const ordering = orderingOf(options.orderBy);
		const groupBy = groupingOf(query.groupBy, options.groupBy);
		const limit = pageLimitOf(query.limit);
		const relations = this.relationsOf(query.relations);
		const base = () => this.filtered(tenantId, organizationId, tree, now, query.timeZone);
		const total = await base().getCount();
		const groups = groupBy === 'none' ? null : await this.groupCounts(base(), groupBy, tenantId);
		const { ids, nextCursor } = ordering.field === 'manual'
			? await this.manualPage(base(), view, decodeCursor(query.cursor), limit)
			: await this.keysetPage(base(), ordering, decodeCursor(query.cursor), limit);
		const items = await this.rowsOf(ids, tenantId, organizationId, relations);
		return { items, nextCursor, total, groups, groupBy, invalidFilters: invalid };
	}

	// ---------------------------------------------------------------- the filter

	/** The view's tasks the caller may list, with the tree applied. */
	private filtered(tenantId: ID, organizationId: ID, tree: ITaskViewFilterGroup | null, now: Date, timeZone?: string | null): SelectQueryBuilder<Task> {
		const builder = this.dataSource
			.getRepository(Task)
			.createQueryBuilder('task')
			.where('task.tenantId = :tenantId', { tenantId })
			.andWhere('task.organizationId = :organizationId', { organizationId })
			.andWhere('task.isScreeningTask = :screening', { screening: false });
		if (tree) {
			const counter = { n: 0 };
			builder.andWhere(new Brackets((where) => this.applyGroup(where, tree, counter, now, timeZone)));
		}
		return builder;
	}

	private applyGroup(where: { where: (c: unknown, p?: ObjectLiteral) => unknown; andWhere: (c: unknown, p?: ObjectLiteral) => unknown; orWhere: (c: unknown, p?: ObjectLiteral) => unknown }, group: ITaskViewFilterGroup, counter: { n: number }, now: Date, timeZone?: string | null): void {
		let first = true;
		for (const entry of group.conditions) {
			const clause: { sql: string | Brackets; params?: ObjectLiteral } | null = isFilterGroup(entry)
				? { sql: new Brackets((nested) => this.applyGroup(nested, entry, counter, now, timeZone)) }
				: this.conditionClause(entry, counter, now, timeZone);
			if (!clause) continue;
			if (first) where.where(clause.sql, clause.params);
			else if (group.op === 'or') where.orWhere(clause.sql, clause.params);
			else where.andWhere(clause.sql, clause.params);
			first = false;
		}
		if (first) where.where('1 = 1');
	}

	private conditionClause(condition: ITaskViewFilterCondition, counter: { n: number }, now: Date, timeZone?: string | null): { sql: string | Brackets; params?: ObjectLiteral } | null {
		const key = `f${counter.n++}`;
		const column = RECORD_COLUMNS[condition.field];
		const membership = MEMBERSHIPS[condition.field];
		if (column) {
			switch (condition.operator) {
				case 'in':
					return { sql: `task.${column} IN (:...${key})`, params: { [key]: condition.values } };
				case 'notIn':
					return { sql: `(task.${column} IS NULL OR task.${column} NOT IN (:...${key}))`, params: { [key]: condition.values } };
				case 'isEmpty':
					return { sql: `task.${column} IS NULL` };
				case 'isNotEmpty':
					return { sql: `task.${column} IS NOT NULL` };
				default:
					return null;
			}
		}
		if (membership) {
			const exists = (values?: ID[]) =>
				`EXISTS (SELECT 1 FROM "${membership.table}" "${key}m" WHERE "${key}m"."taskId" = task.id${values ? ` AND "${key}m"."${membership.column}" IN (:...${key})` : ''})`;
			switch (condition.operator) {
				case 'in':
					return { sql: exists(condition.values), params: { [key]: condition.values } };
				case 'notIn':
					return { sql: `NOT ${exists(condition.values)}`, params: { [key]: condition.values } };
				case 'isEmpty':
					return { sql: `NOT ${exists()}` };
				case 'isNotEmpty':
					return { sql: exists() };
				default:
					return null;
			}
		}
		// A date field.
		const date = `task.${condition.field}`;
		switch (condition.operator) {
			case 'isEmpty':
				return { sql: `${date} IS NULL` };
			case 'isNotEmpty':
				return { sql: `${date} IS NOT NULL` };
			case 'before':
				return { sql: `${date} < :${key}`, params: { [key]: new Date(condition.to as string) } };
			case 'after':
				return { sql: `${date} > :${key}`, params: { [key]: new Date(condition.from as string) } };
			case 'between':
				return { sql: `${date} >= :${key}a AND ${date} <= :${key}b`, params: { [`${key}a`]: new Date(condition.from as string), [`${key}b`]: new Date(condition.to as string) } };
			case 'relative': {
				const window = relativeWindow(condition.relative!, now, timeZone);
				return { sql: `${date} >= :${key}a AND ${date} < :${key}b`, params: { [`${key}a`]: window.from, [`${key}b`]: window.to } };
			}
			default:
				return null;
		}
	}

	/** The tree with the ids that no longer exist taken out of its conditions, each loss reported. */
	private async withoutDeletedReferences(group: ITaskViewFilterGroup, tenantId: ID, path: string, invalid: ITaskViewInvalidFilter[]): Promise<ITaskViewFilterGroup | null> {
		const conditions: Array<ITaskViewFilterCondition | ITaskViewFilterGroup> = [];
		for (const [index, entry] of group.conditions.entries()) {
			const at = `${path}.conditions.${index}`;
			if (isFilterGroup(entry)) {
				const nested = await this.withoutDeletedReferences(entry, tenantId, at, invalid);
				if (nested) conditions.push(nested);
				continue;
			}
			const entity = REFERENCES[entry.field];
			if (!entity || !entry.values?.length) {
				conditions.push(entry);
				continue;
			}
			const existing = new Set((await this.dataSource.getRepository<ObjectLiteral>(entity).find({ select: { id: true }, where: { id: In(entry.values), tenantId } } as never)).map((row) => String(row['id'])));
			const gone = entry.values.filter((id) => !existing.has(String(id)));
			if (gone.length) invalid.push({ path: at, field: entry.field, reason: 'deleted-reference', values: gone });
			const kept = entry.values.filter((id) => existing.has(String(id)));
			if (kept.length) conditions.push({ ...entry, values: kept });
		}
		return conditions.length ? { op: group.op, conditions } : null;
	}

	// ---------------------------------------------------------------- the groups

	private async groupCounts(builder: SelectQueryBuilder<Task>, groupBy: TaskViewGroupBy, tenantId: ID): Promise<ITaskViewGroupCount[]> {
		const field = GROUP_FIELDS[groupBy];
		const column = RECORD_COLUMNS[field];
		const membership = MEMBERSHIPS[field];
		let rows: Array<{ key: ID | null; count: string | number }>;
		if (column) {
			rows = await builder.select(`task.${column}`, 'key').addSelect('COUNT(*)', 'count').groupBy(`task.${column}`).getRawMany();
		} else {
			// A task with two assignees (or labels, or teams) counts in each of its groups; one with none counts under null.
			rows = await builder
				.leftJoin(membership.table, 'g', `"g"."taskId" = task.id`)
				.select(`"g"."${membership.column}"`, 'key')
				.addSelect('COUNT(*)', 'count')
				.groupBy(`"g"."${membership.column}"`)
				.getRawMany();
		}
		const keys = rows.map((row) => row.key).filter((key): key is ID => !!key);
		const labels = await this.labelsOf(REFERENCES[field], keys, tenantId);
		return rows
			.map((row) => ({ key: row.key ?? null, label: row.key ? labels.get(String(row.key)) ?? null : null, count: Number(row.count) || 0 }))
			.sort((a, b) => (a.key === null ? 1 : b.key === null ? -1 : (a.label ?? '').localeCompare(b.label ?? '')));
	}

	private async labelsOf(entity: string, ids: ID[], tenantId: ID): Promise<Map<string, string>> {
		if (!ids.length) return new Map();
		const repository = this.dataSource.getRepository<ObjectLiteral>(entity);
		const rows = await repository.find({
			select: entity === 'Employee' ? { id: true } : { id: true, name: true },
			where: { id: In(ids), tenantId },
			...(entity === 'Employee' ? { relations: { user: true } } : {})
		} as never);
		return new Map(
			rows.map((row) => [
				String(row['id']),
				entity === 'Employee' ? [row['user']?.firstName, row['user']?.lastName].filter(Boolean).join(' ') || String(row['user']?.email ?? '') : String(row['name'] ?? '')
			])
		);
	}

	// ---------------------------------------------------------------- the page

	/** A page by keyset: the rows after the cursor's (sort value, id), `limit` of them, and the cursor of the next. */
	private async keysetPage(builder: SelectQueryBuilder<Task>, ordering: ITaskViewOrdering, cursor: IViewCursor | null, limit: number): Promise<{ ids: ID[]; nextCursor: string | null }> {
		const column = ordering.field === 'title' ? 'task.title' : `task.${ordering.field}`;
		const sortExpression = ordering.field === 'dueDate' ? `COALESCE(task.dueDate, :farFuture)` : column;
		const direction = ordering.direction === 'asc' ? 'ASC' : 'DESC';
		const comparator = direction === 'ASC' ? '>' : '<';
		builder.setParameter('farFuture', new Date(FAR_FUTURE));
		if (cursor && typeof cursor.id === 'string') {
			const value = ordering.field === 'title' ? String(cursor.v ?? '') : new Date(cursor.v ?? FAR_FUTURE);
			builder.andWhere(`(${sortExpression} ${comparator} :cursorValue OR (${sortExpression} = :cursorValue AND task.id ${comparator} :cursorId))`, { cursorValue: value, cursorId: cursor.id });
		}
		const rows = await builder
			.select(['task.id', ordering.field === 'title' ? 'task.title' : `task.${ordering.field}`])
			.orderBy(sortExpression, direction)
			.addOrderBy('task.id', direction)
			.take(limit + 1)
			.getMany();
		const page = rows.slice(0, limit);
		const last = page[page.length - 1];
		const nextCursor = rows.length > limit && last ? encodeCursor({ v: this.sortValueOf(last, ordering), id: String(last.id) }) : null;
		return { ids: page.map((row) => row.id as ID), nextCursor };
	}

	private sortValueOf(task: Task, ordering: ITaskViewOrdering): string | null {
		if (ordering.field === 'title') return String(task.title ?? '');
		const value = (task as unknown as Record<string, unknown>)[ordering.field];
		if (!value && ordering.field === 'dueDate') return FAR_FUTURE;
		return value ? new Date(value as Date).toISOString() : null;
	}

	/** A page of a manual ordering: the view's order first, the rest by creation, by offset (the ordering has no key to seek by). */
	private async manualPage(builder: SelectQueryBuilder<Task>, view: TaskView, cursor: IViewCursor | null, limit: number): Promise<{ ids: ID[]; nextCursor: string | null }> {
		const rows = await builder.select(['task.id', 'task.createdAt']).orderBy('task.createdAt', 'DESC').addOrderBy('task.id', 'DESC').take(TASK_VIEW_MANUAL_ORDER_MAX).getMany();
		const position = new Map((view.manualOrder ?? []).map((id, index) => [String(id), index]));
		const ordered = rows
			.map((row, index) => ({ id: row.id as ID, rank: position.get(String(row.id)) ?? position.size + index }))
			.sort((a, b) => a.rank - b.rank)
			.map((row) => row.id);
		const offset = cursor && typeof cursor.o === 'number' ? cursor.o : 0;
		const page = ordered.slice(offset, offset + limit);
		return { ids: page, nextCursor: offset + limit < ordered.length ? encodeCursor({ o: offset + limit }) : null };
	}

	private relationsOf(requested: unknown): FindOptionsRelations<Task> {
		const names = Array.isArray(requested) && requested.length > 0 ? requested.map(String) : [...BUILT_IN_VIEW_DEFAULT_RELATIONS];
		const refused = names.filter((name) => !BUILT_IN_VIEW_RELATIONS.has(name));
		if (refused.length > 0) {
			throw new BadRequestException(`RELATION_NOT_ALLOWED: a view does not load ${refused.join(', ')}.`);
		}
		return relationsTreeOf(names) as FindOptionsRelations<Task>;
	}

	private async rowsOf(ids: ID[], tenantId: ID, organizationId: ID, relations: FindOptionsRelations<Task>): Promise<ITask[]> {
		if (!ids.length) return [];
		const rows = await this.dataSource.getRepository(Task).find({ where: { id: In(ids), tenantId, organizationId }, relations });
		const byId = new Map(rows.map((task) => [String(task.id), task]));
		return ids.map((id) => byId.get(String(id))).filter((task): task is Task => !!task);
	}
}
