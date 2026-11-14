import { BadRequestException, Injectable } from '@nestjs/common';
import { Brackets, DataSource, FindOptionsRelations, In, ObjectLiteral, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
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
import { quoteIdentifier as q } from '../../database/database.helper';
import { BUILT_IN_VIEW_DEFAULT_RELATIONS, BUILT_IN_VIEW_RELATIONS, relationsTreeOf } from '../built-in-views';
import { Task } from '../task.entity';
import { TaskView } from './view.entity';
import { TaskViewService } from './view.service';
import {
	dateBoundClause,
	DateComparison,
	decodeCursor,
	encodeCursor,
	filterOptionsOf,
	groupingOf,
	isFilterGroup,
	IViewCursor,
	orderingOf,
	pageLimitOf,
	relativeWindow,
	relativeWindowDays,
	TASK_VIEW_DATE_ONLY_FIELDS,
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
/** The ordering whose column may be unset: those rows sort last, whichever direction the dates take. */
const NULLABLE_ORDERINGS: ReadonlySet<string> = new Set(['dueDate']);

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
		const tree = validated.tree ? await this.withoutDeletedReferences(validated.tree, tenantId, validated.paths, invalid) : null;
		const ordering = orderingOf(options.orderBy);
		const groupBy = groupingOf(query.groupBy, options.groupBy);
		const limit = pageLimitOf(query.limit);
		const relations = this.relationsOf(query.relations);
		const base = () => this.filtered(tenantId, organizationId, tree, now, query.timeZone);
		const total = await base().getCount();
		const groups = groupBy === 'none' ? null : await this.groupCounts(base(), groupBy, tenantId);
		const { ids, nextCursor } = ordering.field === 'manual'
			? await this.manualPage(base, view, decodeCursor(query.cursor), limit)
			: await this.keysetPage(base(), ordering, decodeCursor(query.cursor), limit, tenantId);
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

	private applyGroup(where: WhereExpressionBuilder, group: ITaskViewFilterGroup, counter: { n: number }, now: Date, timeZone?: string | null): void {
		let first = true;
		for (const entry of group.conditions) {
			const clause: { sql: string | Brackets; params?: ObjectLiteral } | null = isFilterGroup(entry)
				? { sql: new Brackets((nested) => this.applyGroup(nested, entry, counter, now, timeZone)) }
				: this.conditionClause(entry, counter, now, timeZone);
			if (!clause) continue;
			const method = first ? 'where' : group.op === 'or' ? 'orWhere' : 'andWhere';
			if (clause.sql instanceof Brackets) where[method](clause.sql);
			else where[method](clause.sql, clause.params);
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
			// The join table is named raw, so its identifiers are quoted the way the configured dialect quotes them.
			const alias = q(`${key}m`);
			const exists = (values?: ID[]) =>
				`EXISTS (SELECT 1 FROM ${q(membership.table)} ${alias} WHERE ${alias}.${q('taskId')} = task.id${values ? ` AND ${alias}.${q(membership.column)} IN (:...${key})` : ''})`;
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
		// A date field. A due date may be a date only (midnight UTC of its day): a bound that carries its calendar day
		// compares those by the day, so they fall on the day they name in every zone; moments compare as before.
		const date = `task.${condition.field}`;
		const byDay = TASK_VIEW_DATE_ONLY_FIELDS.includes(condition.field);
		const bound = (comparison: DateComparison, instant: Date, day: string | undefined, name: string) => dateBoundClause(date, comparison, instant, byDay ? day : undefined, name);
		const both = (lower: { sql: string; params: ObjectLiteral }, upper: { sql: string; params: ObjectLiteral }) => ({ sql: `${lower.sql} AND ${upper.sql}`, params: { ...lower.params, ...upper.params } });
		switch (condition.operator) {
			case 'isEmpty':
				return { sql: `${date} IS NULL` };
			case 'isNotEmpty':
				return { sql: `${date} IS NOT NULL` };
			case 'before':
				return bound('<', new Date(condition.to as string), condition.toDay, key);
			case 'after':
				return bound('>', new Date(condition.from as string), condition.fromDay, key);
			case 'between':
				return both(bound('>=', new Date(condition.from as string), condition.fromDay, `${key}a`), bound('<=', new Date(condition.to as string), condition.toDay, `${key}b`));
			case 'relative': {
				const window = relativeWindow(condition.relative!, now, timeZone);
				const days = relativeWindowDays(condition.relative, window, timeZone);
				return both(bound('>=', window.from, days.fromDay, `${key}a`), bound('<', window.to, days.toDay, `${key}b`));
			}
			default:
				return null;
		}
	}

	/**
	 * The tree with the ids that no longer exist taken out of its conditions, each loss reported at the place the
	 * condition had in the tree the caller sent (`paths`), not at its place among the conditions that survived
	 * validation — an unknown field at index 0 and a deleted label at index 1 are two reports, at 0 and at 1.
	 */
	private async withoutDeletedReferences(
		group: ITaskViewFilterGroup,
		tenantId: ID,
		paths: ReadonlyMap<ITaskViewFilterCondition | ITaskViewFilterGroup, string>,
		invalid: ITaskViewInvalidFilter[]
	): Promise<ITaskViewFilterGroup | null> {
		const conditions: Array<ITaskViewFilterCondition | ITaskViewFilterGroup> = [];
		for (const [index, entry] of group.conditions.entries()) {
			const at = paths.get(entry) ?? `${paths.get(group) ?? 'filter'}.conditions.${index}`;
			if (isFilterGroup(entry)) {
				const nested = await this.withoutDeletedReferences(entry, tenantId, paths, invalid);
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
			const key = `${q('g')}.${q(membership.column)}`;
			rows = await builder
				.leftJoin(membership.table, 'g', `${q('g')}.${q('taskId')} = task.id`)
				.select(key, 'key')
				.addSelect('COUNT(*)', 'count')
				.groupBy(key)
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

	/**
	 * A page by keyset: the rows after the cursor's row in the ordering (its sort value, then its id), `limit` of them,
	 * and the cursor of the next. The cursor names the row, so a title of any length makes no cursor a client could not
	 * send back; the row is read back for the stale check and the unset branch, and the seek compares against the row's
	 * stored value in the database itself (a bound `Date` carries milliseconds where a Postgres timestamp carries
	 * microseconds, so a bound value could skip the rows between the two). A row the cursor names that is no longer there
	 * is a cursor the walk cannot resume from (`TASK_VIEW_CURSOR_STALE`: read the first page again).
	 *
	 * A column that may be unset (`dueDate`) sorts its unset rows last whichever direction the dates take: the
	 * ordering is "is it unset" first, then the date, then the id — and the seek past a cursor says the same.
	 */
	private async keysetPage(builder: SelectQueryBuilder<Task>, ordering: ITaskViewOrdering, cursor: IViewCursor | null, limit: number, tenantId: ID): Promise<{ ids: ID[]; nextCursor: string | null }> {
		const field = ordering.field as Exclude<ITaskViewOrdering['field'], 'manual'>;
		const column = `task.${field}`;
		const direction = ordering.direction === 'asc' ? 'ASC' : 'DESC';
		const comparator = direction === 'ASC' ? '>' : '<';
		const nullable = NULLABLE_ORDERINGS.has(field);
		if (cursor && typeof cursor.id === 'string') {
			const anchor = await this.dataSource.getRepository(Task).findOne({ select: { id: true, [field]: true } as never, where: { id: cursor.id, tenantId } });
			if (!anchor) {
				throw new BadRequestException('TASK_VIEW_CURSOR_STALE: the task the cursor names is no longer there; read the first page again.');
			}
			const value = (anchor as unknown as Record<string, unknown>)[field];
			if (nullable && (value === null || value === undefined)) {
				// Past an unset row: the unset rows after it, by id.
				builder.andWhere(`(${column} IS NULL AND task.id ${comparator} :cursorId)`, { cursorId: cursor.id });
			} else {
				const anchorValue = `(SELECT ${q('a')}.${q(field)} FROM ${q('task')} ${q('a')} WHERE ${q('a')}.${q('id')} = :cursorId)`;
				const after = `(${column} ${comparator} ${anchorValue} OR (${column} = ${anchorValue} AND task.id ${comparator} :cursorId))`;
				builder.andWhere(nullable ? `((${column} IS NOT NULL AND ${after}) OR ${column} IS NULL)` : after, { cursorId: cursor.id });
			}
		}
		if (nullable) {
			builder.orderBy(`CASE WHEN ${column} IS NULL THEN 1 ELSE 0 END`, 'ASC').addOrderBy(column, direction);
		} else {
			builder.orderBy(column, direction);
		}
		const rows = await builder.select(['task.id', column]).addOrderBy('task.id', direction).take(limit + 1).getMany();
		const page = rows.slice(0, limit);
		const last = page[page.length - 1];
		const nextCursor = rows.length > limit && last ? encodeCursor({ id: String(last.id) }) : null;
		return { ids: page.map((row) => row.id as ID), nextCursor };
	}

	/**
	 * A page of a manual ordering, by offset (the ordering has no key to seek by): the tasks the view's order names, in
	 * that order, whatever their age — read by their ids, so one the person put first is never lost behind newer
	 * tasks — then the newest `TASK_VIEW_MANUAL_ORDER_MAX` of the rest.
	 */
	private async manualPage(base: () => SelectQueryBuilder<Task>, view: TaskView, cursor: IViewCursor | null, limit: number): Promise<{ ids: ID[]; nextCursor: string | null }> {
		const order = [...new Set((view.manualOrder ?? []).map(String))].slice(0, TASK_VIEW_MANUAL_ORDER_MAX);
		const position = new Map(order.map((id, index) => [id, index]));
		const ordered = order.length
			? (await base().select(['task.id']).andWhere('task.id IN (:...ordered)', { ordered: order }).getMany())
					.map((row) => String(row.id))
					.sort((a, b) => (position.get(a) ?? 0) - (position.get(b) ?? 0))
			: [];
		const rest = base().select(['task.id']).orderBy('task.createdAt', 'DESC').addOrderBy('task.id', 'DESC').take(TASK_VIEW_MANUAL_ORDER_MAX);
		if (order.length) rest.andWhere('task.id NOT IN (:...ordered)', { ordered: order });
		const ids = [...ordered, ...(await rest.getMany()).map((row) => String(row.id))] as ID[];
		const offset = cursor && typeof cursor.o === 'number' ? cursor.o : 0;
		const page = ids.slice(offset, offset + limit);
		return { ids: page, nextCursor: offset + limit < ids.length ? encodeCursor({ o: offset + limit }) : null };
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
