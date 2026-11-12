import { ID, ITask, ITaskViewGroupCount, TaskViewGroupBy } from '@gauzy/contracts';

/** One group of loaded rows: the key the platform counts it under (`''` for none), its name, its count, its rows. */
export interface RowGroup {
	key: string;
	label: string;
	count: number | null;
	rows: ITask[];
}

/** The groups a task falls in: one key for a record field (`''` when unset), one per member, team or label. */
export function groupKeysOf(task: ITask, groupBy: TaskViewGroupBy): string[] {
	const ids = (list: Array<{ id?: ID }> | undefined) => {
		const keys = (list ?? []).map((item) => String(item.id ?? '')).filter(Boolean);
		return keys.length ? [...new Set(keys)] : [''];
	};
	switch (groupBy) {
		case 'status':
			return [String(task.taskStatusId ?? task.taskStatus?.id ?? '')];
		case 'priority':
			return [String(task.taskPriorityId ?? task.taskPriority?.id ?? '')];
		case 'size':
			return [String(task.taskSizeId ?? task.taskSize?.id ?? '')];
		case 'project':
			return [String(task.projectId ?? task.project?.id ?? '')];
		case 'sprint':
			return [String(task.organizationSprintId ?? task.organizationSprint?.id ?? '')];
		case 'assignee':
			return ids(task.members);
		case 'team':
			return ids(task.teams);
		case 'label':
			return ids(task.tags);
		default:
			return [''];
	}
}

/**
 * The loaded rows under their groups, in the order the platform counted the groups (the groups it counted that hold
 * no loaded row yet are kept, so their counts show), then any group found only among the rows. A task with two
 * assignees is in both groups. Without a grouping, one group of every row.
 */
export function groupRows(
	rows: readonly ITask[],
	groupBy: TaskViewGroupBy,
	counts: readonly ITaskViewGroupCount[] | null | undefined,
	labelOf: (key: string) => string = () => ''
): RowGroup[] {
	if (groupBy === 'none') return [{ key: '', label: '', count: null, rows: [...rows] }];
	const groups = new Map<string, RowGroup>();
	for (const count of counts ?? []) {
		const key = String(count.key ?? '');
		groups.set(key, { key, label: count.label ?? labelOf(key), count: Number(count.count) || 0, rows: [] });
	}
	for (const row of rows) {
		for (const key of groupKeysOf(row, groupBy)) {
			let group = groups.get(key);
			if (!group) {
				group = { key, label: labelOf(key), count: null, rows: [] };
				groups.set(key, group);
			}
			group.rows.push(row);
		}
	}
	return [...groups.values()].map((group) => ({ ...group, label: group.label || labelOf(group.key) }));
}

/** Every task of the groups once, in the order shown: what the selection ranges over and J / K walk. */
export function visibleOrder(groups: readonly RowGroup[]): ID[] {
	const seen = new Set<string>();
	const order: ID[] = [];
	for (const group of groups) {
		for (const row of group.rows) {
			const id = String(row.id ?? '');
			if (!id || seen.has(id)) continue;
			seen.add(id);
			order.push(id as ID);
		}
	}
	return order;
}

/** The row J (down) or K (up) moves to from the focused one; the first (or last) when none is focused. */
export function nextFocus(order: readonly ID[], focused: ID | null, direction: 1 | -1): ID | null {
	if (!order.length) return null;
	const at = focused ? order.indexOf(focused) : -1;
	if (at < 0) return direction === 1 ? order[0] : order[order.length - 1];
	return order[Math.max(0, Math.min(order.length - 1, at + direction))];
}

/** Rows appended from the next page, each task once (a task moved between pages is not listed twice). */
export function appendRows(current: readonly ITask[], next: readonly ITask[]): ITask[] {
	const seen = new Set(current.map((row) => String(row.id)));
	return [...current, ...next.filter((row) => !seen.has(String(row.id)))];
}
