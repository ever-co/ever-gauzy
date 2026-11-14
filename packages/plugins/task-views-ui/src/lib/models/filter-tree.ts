import {
	ID,
	ITaskViewFilterCondition,
	ITaskViewFilterGroup,
	ITaskViewInvalidFilter,
	ITaskViewRelativeDate,
	TaskViewFilterField,
	TaskViewFilterOperator
} from '@gauzy/contracts';
import { type BoundKind, boundOfDay } from './date-input';

/**
 * The model of the filter-tree editor: pure, immutable operations on a view's filter tree (the platform's contract,
 * `ITaskViewFilterGroup`). A node is found by its path, the indexes of the conditions leading to it from the root
 * (`[]` is the root, `[0, 2]` the third condition of the root's first group); the platform names the same place
 * `filter.conditions.0.conditions.2`.
 */

export type FilterNode = ITaskViewFilterCondition | ITaskViewFilterGroup;
export type FilterPath = readonly number[];

/** What kind of values a field takes: records (ids of statuses, labels, people, …) or dates. */
export type FilterFieldKind = 'record' | 'date';

/** The fields the platform filters on, in the order the editor offers them. */
export const FILTER_FIELDS: readonly TaskViewFilterField[] = [
	'status',
	'priority',
	'size',
	'labels',
	'assignees',
	'project',
	'team',
	'sprint',
	'dueDate',
	'createdAt',
	'updatedAt'
];
export const DATE_FIELDS: ReadonlySet<TaskViewFilterField> = new Set<TaskViewFilterField>([
	'dueDate',
	'createdAt',
	'updatedAt'
]);
export const RECORD_OPERATORS: readonly TaskViewFilterOperator[] = ['in', 'notIn', 'isEmpty', 'isNotEmpty'];
export const DATE_OPERATORS: readonly TaskViewFilterOperator[] = [
	'relative',
	'before',
	'after',
	'between',
	'isEmpty',
	'isNotEmpty'
];

/** The platform's limits: nodes in one tree (groups count), and how deep groups nest. */
export const FILTER_MAX_NODES = 100;
export const FILTER_MAX_DEPTH = 8;

export function isFilterGroup(node: unknown): node is ITaskViewFilterGroup {
	return !!node && typeof node === 'object' && Array.isArray((node as ITaskViewFilterGroup).conditions);
}

export function fieldKindOf(field: TaskViewFilterField): FilterFieldKind {
	return DATE_FIELDS.has(field) ? 'date' : 'record';
}

/** The operators a field takes. */
export function operatorsOf(field: TaskViewFilterField): readonly TaskViewFilterOperator[] {
	return fieldKindOf(field) === 'date' ? DATE_OPERATORS : RECORD_OPERATORS;
}

export function emptyGroup(op: 'and' | 'or' = 'and'): ITaskViewFilterGroup {
	return { op, conditions: [] };
}

/** A new condition on a field: "is any of" nothing yet for records, "this week" for dates. */
export function newCondition(field: TaskViewFilterField): ITaskViewFilterCondition {
	if (fieldKindOf(field) === 'date') {
		return { field, operator: 'relative', relative: { unit: 'week', direction: 'current' } };
	}
	return { field, operator: 'in', values: [] };
}

/** The condition on another field: its operator and values start over (the ids named another kind of record). */
export function withField(condition: ITaskViewFilterCondition, field: TaskViewFilterField): ITaskViewFilterCondition {
	if (condition.field === field) return condition;
	return newCondition(field);
}

/**
 * The condition with another operator: ids are kept between "is any of" and "is none of", dates are kept where the
 * new operator reads them, and the empties take nothing.
 */
export function withOperator(
	condition: ITaskViewFilterCondition,
	operator: TaskViewFilterOperator
): ITaskViewFilterCondition {
	if (!operatorsOf(condition.field).includes(operator)) return condition;
	const next: ITaskViewFilterCondition = { field: condition.field, operator };
	switch (operator) {
		case 'in':
		case 'notIn':
			next.values = [...(condition.values ?? [])];
			break;
		case 'before':
			keepTo(condition, next, 'before');
			break;
		case 'after':
			keepFrom(condition, next);
			break;
		case 'between':
			keepFrom(condition, next);
			keepTo(condition, next, 'until');
			break;
		case 'relative':
			next.relative = condition.relative ? { ...condition.relative } : { unit: 'week', direction: 'current' };
			break;
	}
	return next;
}

function keepFrom(condition: ITaskViewFilterCondition, next: ITaskViewFilterCondition): void {
	if (!condition.from) return;
	next.from = condition.from;
	if (condition.fromDay) next.fromDay = condition.fromDay;
}

/**
 * The upper bound under a new operator. "Before" reads the start of its day and "between" the last instant of its
 * last day, so a bound picked as a day takes the instant the new operator reads of that day; one saved without its
 * day keeps its instant. The instant is the one of the reader's zone, as when they pick a day: a view saved in
 * another zone keeps its day, and its instant becomes the reader's.
 */
function keepTo(condition: ITaskViewFilterCondition, next: ITaskViewFilterCondition, kind: BoundKind): void {
	if (!condition.to) return;
	const rebound = condition.toDay ? boundOfDay(condition.toDay, kind) : null;
	next.to = rebound ? rebound.instant : condition.to;
	if (rebound) next.toDay = rebound.day;
}

/** The condition with other values: ids for a record field, each once. */
export function withValues(condition: ITaskViewFilterCondition, values: readonly ID[]): ITaskViewFilterCondition {
	return { ...condition, values: [...new Set(values)] };
}

/** The condition with a relative window (`amount` only counts for the past and the future). */
export function withRelative(
	condition: ITaskViewFilterCondition,
	relative: ITaskViewRelativeDate
): ITaskViewFilterCondition {
	const amount =
		relative.direction === 'current'
			? undefined
			: Math.min(366, Math.max(1, Math.round(Number(relative.amount) || 1)));
	return {
		...condition,
		relative: { unit: relative.unit, direction: relative.direction, ...(amount ? { amount } : {}) }
	};
}

/**
 * The condition with a bound changed: an ISO instant and the calendar day it was picked as (`2026-11-14`), or
 * nothing. An instant without a day drops the day the bound had, which named another instant.
 */
export function withBound(
	condition: ITaskViewFilterCondition,
	bound: 'from' | 'to',
	instant: string | null,
	day: string | null = null
): ITaskViewFilterCondition {
	const next = { ...condition };
	const dayKey = bound === 'from' ? 'fromDay' : 'toDay';
	if (instant) next[bound] = instant;
	else delete next[bound];
	if (instant && day) next[dayKey] = day;
	else delete next[dayKey];
	return next;
}

/**
 * The condition with a day picked in one bound's date field (an empty or malformed field clears the bound and leaves
 * the other alone). The instant is the one of the picker's zone, and so becomes the other bound's when it was picked
 * as a day too: kept as another reader's instant, a "between 14 and 14 Nov" saved in UTC−10 and edited in UTC+14
 * would end before it starts while both fields show the 14th. A bound saved without its day keeps its instant, which
 * the field already shows as the reader's day.
 */
export function withPickedDay(
	condition: ITaskViewFilterCondition,
	bound: 'from' | 'to',
	value: string | null | undefined,
	kind: BoundKind
): ITaskViewFilterCondition {
	const picked = boundOfDay(value, kind);
	const next = withBound(condition, bound, picked?.instant ?? null, picked?.day ?? null);
	const other = bound === 'from' ? 'to' : 'from';
	const otherDay = other === 'from' ? next.fromDay : next.toDay;
	const otherKind: BoundKind = other === 'from' ? 'from' : next.operator === 'before' ? 'before' : 'until';
	const rebound = picked && next[other] && otherDay ? boundOfDay(otherDay, otherKind) : null;
	return rebound ? withBound(next, other, rebound.instant, rebound.day) : next;
}

/** The node at a path, or null when there is none. */
export function nodeAt(tree: ITaskViewFilterGroup | null, path: FilterPath): FilterNode | null {
	let node: FilterNode | null = tree;
	for (const index of path) {
		if (!isFilterGroup(node)) return null;
		node = node.conditions[index] ?? null;
	}
	return node;
}

/** How many nodes a tree holds, groups (the root included) counted as the platform counts them. */
export function countNodes(tree: ITaskViewFilterGroup | null): number {
	if (!tree) return 0;
	return 1 + tree.conditions.reduce((sum, node) => sum + (isFilterGroup(node) ? countNodes(node) : 1), 0);
}

/**
 * Whether a condition, or a group with its first condition, fits the tree (the platform's node budget), and a group
 * may nest that deep in the group at the path.
 */
export function canAdd(
	tree: ITaskViewFilterGroup | null,
	kind: 'condition' | 'group',
	groupPath: FilterPath = []
): boolean {
	const needed = kind === 'group' ? 2 : 1;
	if (countNodes(tree ?? emptyGroup()) + needed > FILTER_MAX_NODES) return false;
	return kind === 'condition' || groupPath.length + 1 <= FILTER_MAX_DEPTH;
}

/** The tree with a condition added at the end of the group at the path (the root is made when there is none). */
export function addCondition(
	tree: ITaskViewFilterGroup | null,
	groupPath: FilterPath,
	condition: ITaskViewFilterCondition
): ITaskViewFilterGroup {
	return updateGroup(tree ?? emptyGroup(), groupPath, (group) => ({
		...group,
		conditions: [...group.conditions, condition]
	}));
}

/** The tree with a nested group added at the end of the group at the path, holding one condition to start with. */
export function addGroup(
	tree: ITaskViewFilterGroup | null,
	groupPath: FilterPath,
	op: 'and' | 'or',
	first: ITaskViewFilterCondition
): ITaskViewFilterGroup {
	return updateGroup(tree ?? emptyGroup(), groupPath, (group) => ({
		...group,
		conditions: [...group.conditions, { op, conditions: [first] }]
	}));
}

/** The tree with the node at the path replaced by what `change` makes of it. */
export function updateNode(
	tree: ITaskViewFilterGroup,
	path: FilterPath,
	change: (node: FilterNode) => FilterNode
): ITaskViewFilterGroup {
	if (!path.length) {
		const root = change(tree);
		return isFilterGroup(root) ? root : tree;
	}
	const parentPath = path.slice(0, -1);
	const index = path[path.length - 1];
	return updateGroup(tree, parentPath, (group) => {
		const current = group.conditions[index];
		if (current === undefined) return group;
		const conditions = [...group.conditions];
		conditions[index] = change(current);
		return { ...group, conditions };
	});
}

/** The tree with the group at the path joining its conditions by `and` or `or`. */
export function setGroupOp(tree: ITaskViewFilterGroup, path: FilterPath, op: 'and' | 'or'): ITaskViewFilterGroup {
	return updateNode(tree, path, (node) => (isFilterGroup(node) ? { ...node, op } : node));
}

/**
 * The tree without the node at the path. A nested group left empty goes too (it would filter nothing); the root
 * stays, and a root left with no condition is no filter at all (null).
 */
export function removeNode(tree: ITaskViewFilterGroup | null, path: FilterPath): ITaskViewFilterGroup | null {
	if (!tree) return null;
	if (!path.length) return null;
	const parentPath = path.slice(0, -1);
	const index = path[path.length - 1];
	let next = updateGroup(tree, parentPath, (group) => ({
		...group,
		conditions: group.conditions.filter((_node, at) => at !== index)
	}));
	// Climb: a nested group the removal emptied goes as well.
	let at = parentPath;
	while (at.length) {
		const group = nodeAt(next, at);
		if (!isFilterGroup(group) || group.conditions.length) break;
		const parent = at.slice(0, -1);
		const groupIndex = at[at.length - 1];
		next = updateGroup(next, parent, (owner) => ({
			...owner,
			conditions: owner.conditions.filter((_node, i) => i !== groupIndex)
		}));
		at = parent;
	}
	return next.conditions.length ? next : null;
}

/** Whether a condition says enough to be applied: ids for "is any of", the dates its operator reads. */
export function isComplete(condition: ITaskViewFilterCondition): boolean {
	switch (condition.operator) {
		case 'in':
		case 'notIn':
			return (condition.values ?? []).length > 0;
		case 'before':
			return !!condition.to;
		case 'after':
			return !!condition.from;
		case 'between':
			return !!condition.from && !!condition.to;
		case 'relative':
			return !!condition.relative;
		default:
			return true;
	}
}

/** The platform's name for a place in the tree (`filter.conditions.0.conditions.2`). */
export function apiPathOf(path: FilterPath): string {
	return ['filter', ...path.map((index) => `conditions.${index}`)].join('.');
}

/** The place in the tree a platform path names, or null for one that is not a path of the tree. */
export function pathOfApi(apiPath: string | null | undefined): number[] | null {
	const parts = String(apiPath ?? '').split('.');
	if (parts[0] !== 'filter' || parts.length % 2 === 0) return null;
	const path: number[] = [];
	for (let at = 1; at < parts.length; at += 2) {
		const index = Number(parts[at + 1]);
		if (parts[at] !== 'conditions' || !Number.isInteger(index) || index < 0) return null;
		path.push(index);
	}
	return path;
}

/** The key a path is stored under in a map. */
export function pathKey(path: FilterPath): string {
	return path.join('.');
}

/**
 * What the editor sends while the person edits: the tree without the conditions that do not say enough yet (an
 * "is any of" with nothing picked) and without the groups that leaves empty, and, for each node sent, its place in
 * the tree the editor holds — the platform reports invalid conditions by their place in what it was sent.
 */
export interface ApplicableTree {
	tree: ITaskViewFilterGroup | null;
	/** Platform path of a node sent (`filter.conditions.1`) → its path in the editor's tree. */
	paths: Map<string, number[]>;
}

export function applicableTree(tree: ITaskViewFilterGroup | null): ApplicableTree {
	const paths = new Map<string, number[]>();
	const visit = (
		group: ITaskViewFilterGroup,
		editorPath: number[],
		sentPath: number[]
	): ITaskViewFilterGroup | null => {
		const conditions: FilterNode[] = [];
		group.conditions.forEach((node, index) => {
			const at = [...editorPath, index];
			const sentAt = [...sentPath, conditions.length];
			if (isFilterGroup(node)) {
				const nested = visit(node, at, sentAt);
				if (nested) {
					conditions.push(nested);
					paths.set(apiPathOf(sentAt), at);
				}
				return;
			}
			if (!isComplete(node)) return;
			conditions.push(node);
			paths.set(apiPathOf(sentAt), at);
		});
		return conditions.length ? { op: group.op === 'or' ? 'or' : 'and', conditions } : null;
	};
	const result = tree ? visit(tree, [], []) : null;
	if (result) paths.set(apiPathOf([]), []);
	return { tree: result, paths };
}

/** The invalid filters the platform reported, by the editor path (`pathKey`) of the condition each names. */
export function invalidByPath(
	invalid: readonly ITaskViewInvalidFilter[] | null | undefined,
	sent: ApplicableTree | null
): Map<string, ITaskViewInvalidFilter[]> {
	const byPath = new Map<string, ITaskViewInvalidFilter[]>();
	for (const entry of invalid ?? []) {
		const editorPath = sent?.paths.get(entry.path) ?? pathOfApi(entry.path);
		if (!editorPath) continue;
		const key = pathKey(editorPath);
		byPath.set(key, [...(byPath.get(key) ?? []), entry]);
	}
	return byPath;
}

/**
 * The tree with the invalid filters fixed the way the person asked: a condition on deleted records keeps the ids
 * that still exist (it goes when none does), any other invalid condition goes.
 */
export function withoutInvalid(
	tree: ITaskViewFilterGroup | null,
	invalid: ReadonlyMap<string, ITaskViewInvalidFilter[]>
): ITaskViewFilterGroup | null {
	if (!tree) return null;
	// In reverse reading order (a node before the group holding it), so a fix never moves a node still to be fixed.
	const paths = [...invalid.keys()].map((key) => (key === '' ? [] : key.split('.').map(Number))).sort(compareDesc);
	let next: ITaskViewFilterGroup | null = tree;
	for (const path of paths) {
		if (!next) break;
		const node = nodeAt(next, path);
		if (!node) continue;
		const entries = invalid.get(pathKey(path)) ?? [];
		const deleted = entries
			.filter((entry) => entry.reason === 'deleted-reference')
			.flatMap((entry) => entry.values ?? []);
		const onlyDeleted = entries.length > 0 && entries.every((entry) => entry.reason === 'deleted-reference');
		if (!isFilterGroup(node) && onlyDeleted && (node.values ?? []).some((id) => !deleted.includes(id))) {
			next = updateNode(next, path, (current) =>
				withValues(
					current as ITaskViewFilterCondition,
					((current as ITaskViewFilterCondition).values ?? []).filter((id) => !deleted.includes(id))
				)
			);
			continue;
		}
		next = removeNode(next, path);
	}
	return next;
}

/** Every condition of a tree with its path, in reading order: what a summary or a check walks. */
export function conditionsOf(
	tree: ITaskViewFilterGroup | null
): Array<{ path: number[]; condition: ITaskViewFilterCondition }> {
	const found: Array<{ path: number[]; condition: ITaskViewFilterCondition }> = [];
	const visit = (group: ITaskViewFilterGroup, path: number[]) =>
		group.conditions.forEach((node, index) => {
			const at = [...path, index];
			if (isFilterGroup(node)) visit(node, at);
			else found.push({ path: at, condition: node });
		});
	if (tree) visit(tree, []);
	return found;
}

/** A tree read from storage, kept only as far as it has the shape of one (a client may have stored anything). */
export function treeOf(value: unknown): ITaskViewFilterGroup | null {
	if (!isFilterGroup(value)) return null;
	const visit = (group: ITaskViewFilterGroup, depth: number): ITaskViewFilterGroup => ({
		op: group.op === 'or' ? 'or' : 'and',
		conditions: group.conditions
			.filter(
				(node) =>
					isFilterGroup(node) ||
					(!!node && typeof node === 'object' && typeof (node as ITaskViewFilterCondition).field === 'string')
			)
			.map((node) =>
				isFilterGroup(node)
					? depth < FILTER_MAX_DEPTH
						? visit(node, depth + 1)
						: node
					: { ...(node as ITaskViewFilterCondition) }
			)
	});
	const tree = visit(value, 0);
	return tree.conditions.length ? tree : null;
}

function updateGroup(
	tree: ITaskViewFilterGroup,
	path: FilterPath,
	change: (group: ITaskViewFilterGroup) => ITaskViewFilterGroup
): ITaskViewFilterGroup {
	if (!path.length) return change(tree);
	const [index, ...rest] = path;
	const child = tree.conditions[index];
	if (!isFilterGroup(child)) return tree;
	const conditions = [...tree.conditions];
	conditions[index] = updateGroup(child, rest, change);
	return { ...tree, conditions };
}

/** Reverse reading order: later nodes first, and a nested node before the group that holds it. */
function compareDesc(a: readonly number[], b: readonly number[]): number {
	for (let at = 0; at < Math.min(a.length, b.length); at += 1) {
		if (a[at] !== b[at]) return b[at] - a[at];
	}
	return b.length - a.length;
}
