import {
	ID,
	ITaskView,
	ITaskViewCreateInput,
	ITaskViewFilterGroup,
	ITaskViewOrdering,
	ITaskViewUpdateInput,
	JsonData,
	TaskBuiltInViewEnum,
	TaskViewGroupBy,
	TaskViewOrderField,
	TaskViewVisibilityEnum,
	VisibilityLevelEnum
} from '@gauzy/contracts';
import { treeOf } from './filter-tree';

/** How a view draws its tasks: as rows, or as bars on a calendar from their start to their due date. */
export type TaskViewLayout = 'list' | 'timeline';

export const TASK_VIEW_LAYOUTS: readonly TaskViewLayout[] = ['list', 'timeline'];

/** What a view shows: its filter tree, its grouping, its ordering, the properties the rows show, and its layout. */
export interface TaskViewDefinition {
	filter: ITaskViewFilterGroup | null;
	groupBy: TaskViewGroupBy;
	orderBy: Required<ITaskViewOrdering>;
	/** The row properties shown (property → shown); a property not named keeps its default. */
	properties: Record<string, boolean>;
	layout: TaskViewLayout;
}

export const TASK_VIEW_GROUPINGS: readonly TaskViewGroupBy[] = [
	'none',
	'status',
	'priority',
	'size',
	'project',
	'sprint',
	'assignee',
	'team',
	'label'
];
export const TASK_VIEW_ORDER_FIELDS: readonly TaskViewOrderField[] = [
	'createdAt',
	'updatedAt',
	'dueDate',
	'title',
	'manual'
];

/** The row properties the list can show, and whether each shows when a view says nothing about it. */
export const ROW_PROPERTIES: Readonly<Record<string, boolean>> = {
	reference: true,
	status: true,
	priority: true,
	size: false,
	assignees: true,
	labels: true,
	project: true,
	dueDate: true
};

/** The ordering the platform uses when a view names none (and the direction of each field when none is named). */
export function orderingOf(value: unknown): Required<ITaskViewOrdering> {
	const raw = (value ?? {}) as Partial<ITaskViewOrdering>;
	const field = TASK_VIEW_ORDER_FIELDS.includes(raw.field as TaskViewOrderField)
		? (raw.field as TaskViewOrderField)
		: 'createdAt';
	const direction =
		raw.direction === 'asc' || raw.direction === 'desc'
			? raw.direction
			: field === 'dueDate' || field === 'title'
				? 'asc'
				: 'desc';
	return { field, direction };
}

export function groupingOf(value: unknown): TaskViewGroupBy {
	return TASK_VIEW_GROUPINGS.includes(value as TaskViewGroupBy) ? (value as TaskViewGroupBy) : 'none';
}

export const DEFAULT_DEFINITION: TaskViewDefinition = Object.freeze({
	filter: null,
	groupBy: 'none',
	orderBy: { field: 'createdAt', direction: 'desc' },
	properties: {},
	layout: 'list'
}) as TaskViewDefinition;

/** A JSON column as an object (SQLite may answer its text), or an empty object. */
export function jsonObjectOf(raw: unknown): Record<string, unknown> {
	let value: unknown = raw;
	if (typeof raw === 'string' && raw.trim()) {
		try {
			value = JSON.parse(raw);
		} catch {
			value = null;
		}
	}
	return value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

/** What a saved view shows, read from its columns with every default in place. */
export function definitionOf(
	view: Pick<ITaskView, 'filterOptions' | 'properties' | 'displayOptions'> | null | undefined
): TaskViewDefinition {
	if (!view) return { ...DEFAULT_DEFINITION, properties: {} };
	const options = jsonObjectOf(view.filterOptions);
	const properties: Record<string, boolean> = {};
	for (const [key, shown] of Object.entries(jsonObjectOf(view.properties))) {
		if (typeof shown === 'boolean') properties[key] = shown;
	}
	return {
		filter: treeOf(options['filter']),
		groupBy: groupingOf(options['groupBy']),
		orderBy: orderingOf(options['orderBy']),
		properties,
		layout: layoutOf(view.displayOptions)
	};
}

/**
 * The layout a view's `displayOptions` names: the timeline, or else the list. Ever Teams writes the layout there too,
 * only when it is not the list (`'board'` or `'timeline'`); a board, which this page does not draw, shows as the list.
 */
export function layoutOf(displayOptions: unknown): TaskViewLayout {
	return jsonObjectOf(displayOptions)['layout'] === 'timeline' ? 'timeline' : 'list';
}

/**
 * The `displayOptions` a definition is saved as, over what the view held: a timeline is written as such; the list
 * clears a timeline (the list is the layout of a view that names none) and leaves a layout this page does not draw
 * (an Ever Teams board) as it is. The other keys another client keeps there stay.
 */
export function displayOptionsOf(definition: TaskViewDefinition, previous?: unknown): JsonData {
	const options = jsonObjectOf(previous);
	if (definition.layout === 'timeline') return { ...options, layout: 'timeline' } as JsonData;
	if (options['layout'] === 'timeline') delete options['layout'];
	return options as JsonData;
}

/**
 * The `filterOptions` a definition is saved as: the filter tree, the grouping and the ordering, written over what
 * the view held there before, so the keys another client keeps in the same column (Ever Teams keeps its own
 * filters there) stay as they are.
 */
export function filterOptionsOf(definition: TaskViewDefinition, previous?: unknown): JsonData {
	return {
		...jsonObjectOf(previous),
		filter: definition.filter,
		groupBy: definition.groupBy,
		orderBy: definition.orderBy
	} as JsonData;
}

/** The `properties` a definition is saved as, over the ones the view held. */
export function propertiesOf(definition: TaskViewDefinition, previous?: unknown): Record<string, boolean> {
	const kept: Record<string, boolean> = {};
	for (const [key, shown] of Object.entries(jsonObjectOf(previous))) {
		if (typeof shown === 'boolean') kept[key] = shown;
	}
	return { ...kept, ...definition.properties };
}

/** Whether a row property shows under a definition. */
export function isPropertyShown(definition: TaskViewDefinition, property: string): boolean {
	return definition.properties[property] ?? ROW_PROPERTIES[property] ?? false;
}

/** Whether two definitions show the same list. */
export function isSameDefinition(first: TaskViewDefinition, second: TaskViewDefinition): boolean {
	const properties = (definition: TaskViewDefinition) =>
		Object.keys(ROW_PROPERTIES).map((key) => isPropertyShown(definition, key));
	return (
		JSON.stringify(first.filter ?? null) === JSON.stringify(second.filter ?? null) &&
		first.groupBy === second.groupBy &&
		first.orderBy.field === second.orderBy.field &&
		first.orderBy.direction === second.orderBy.direction &&
		JSON.stringify(properties(first)) === JSON.stringify(properties(second)) &&
		(first.layout ?? 'list') === (second.layout ?? 'list')
	);
}

// ---------------------------------------------------------------- the views a person may open

/** Where a saved view belongs: mine only, a team's, a project's, or the whole organization's. */
export type TaskViewScope = 'personal' | 'team' | 'project' | 'organization';

export function scopeOfView(view: Pick<ITaskView, 'visibility' | 'organizationTeamId' | 'projectId'>): TaskViewScope {
	if (view.visibility === TaskViewVisibilityEnum.PERSONAL) return 'personal';
	if (view.organizationTeamId) return 'team';
	if (view.projectId) return 'project';
	return 'organization';
}

export interface GroupedViews {
	personal: ITaskView[];
	team: ITaskView[];
	project: ITaskView[];
	organization: ITaskView[];
}

/** The saved views by where they belong, each list by name. */
export function groupViews(views: readonly ITaskView[]): GroupedViews {
	const grouped: GroupedViews = { personal: [], team: [], project: [], organization: [] };
	for (const view of views) grouped[scopeOfView(view)].push(view);
	const byName = (a: ITaskView, b: ITaskView) =>
		(a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' });
	for (const list of Object.values(grouped)) list.sort(byName);
	return grouped;
}

/** The built-in views in the order the switcher lists them. */
export const BUILT_IN_VIEWS: readonly TaskBuiltInViewEnum[] = [
	TaskBuiltInViewEnum.MINE,
	TaskBuiltInViewEnum.THIS_WEEK,
	TaskBuiltInViewEnum.OVERDUE,
	TaskBuiltInViewEnum.DUE_SOON
];

export function isBuiltInViewKey(key: unknown): key is TaskBuiltInViewEnum {
	return BUILT_IN_VIEWS.includes(key as TaskBuiltInViewEnum);
}

/** The name a view is saved under: trimmed and cut to the longest the dialog takes; empty when nothing is left. */
export function normalizedViewName(name: string | null | undefined, max: number): string {
	return String(name ?? '')
		.trim()
		.replace(/\s+/g, ' ')
		.slice(0, max);
}

/** Who a new view is for, as the save dialog asks it. */
export interface TaskViewPlacement {
	name: string;
	visibility: TaskViewVisibilityEnum;
	organizationTeamId?: ID | null;
	projectId?: ID | null;
}

/** The body that creates a view: the definition's columns, the placement, and the scope of the request. */
export function createInput(
	definition: TaskViewDefinition,
	placement: TaskViewPlacement,
	scope: { organizationId: ID; tenantId?: ID },
	from?: Pick<ITaskView, 'filterOptions' | 'properties' | 'displayOptions' | 'queryParams'> | null
): ITaskViewCreateInput {
	return {
		organizationId: scope.organizationId,
		...(scope.tenantId ? { tenantId: scope.tenantId } : {}),
		name: placement.name,
		visibility: placement.visibility,
		visibilityLevel: visibilityLevelOf(placement),
		organizationTeamId: placement.organizationTeamId ?? null,
		projectId: placement.projectId ?? null,
		filterOptions: filterOptionsOf(definition, from?.filterOptions),
		properties: propertiesOf(definition, from?.properties),
		...displayOptionsInput(definition, from?.displayOptions, !!from?.displayOptions),
		...(from?.queryParams ? { queryParams: jsonObjectOf(from.queryParams) as JsonData } : {})
	} as ITaskViewCreateInput;
}

/** The body that saves a definition into a view, stating the version it was read at. */
export function saveInput(
	view: ITaskView,
	definition: TaskViewDefinition,
	scope: { organizationId: ID; tenantId?: ID }
): ITaskViewUpdateInput {
	return {
		organizationId: scope.organizationId,
		...(scope.tenantId ? { tenantId: scope.tenantId } : {}),
		filterOptions: filterOptionsOf(definition, view.filterOptions),
		properties: propertiesOf(definition, view.properties),
		// The layout is written only when it changes: a save of the filters leaves the column as another client keeps it.
		...displayOptionsInput(definition, view.displayOptions, false),
		expectedVersion: versionOf(view)
	};
}

/** `displayOptions` for a create or a save body: sent when `always`, or when the definition's layout needs writing. */
function displayOptionsInput(
	definition: TaskViewDefinition,
	previous: unknown,
	always: boolean
): { displayOptions?: JsonData } {
	if (!always && (definition.layout ?? 'list') === layoutOf(previous)) return {};
	return { displayOptions: displayOptionsOf(definition, previous) };
}

/** The visibility level of where a view is listed: a team's or a project's, else the organization's. */
export function visibilityLevelOf(placement: {
	organizationTeamId?: ID | null;
	projectId?: ID | null;
}): VisibilityLevelEnum {
	return placement.organizationTeamId || placement.projectId
		? VisibilityLevelEnum.TEAM_AND_PROJECT
		: VisibilityLevelEnum.ORGANIZATION;
}

/**
 * The body that renames a view or changes who sees it, stating the version it was read at. A change of where the
 * view is listed (team, project) moves its visibility level with it, from the team and project in effect after the
 * change (what the change leaves out is the view's own).
 */
export function placementInput(
	view: ITaskView,
	change: Partial<TaskViewPlacement>,
	scope: { organizationId: ID; tenantId?: ID }
): ITaskViewUpdateInput {
	return {
		organizationId: scope.organizationId,
		...(scope.tenantId ? { tenantId: scope.tenantId } : {}),
		...(change.name !== undefined ? { name: change.name } : {}),
		...(change.visibility !== undefined ? { visibility: change.visibility } : {}),
		...(change.organizationTeamId !== undefined ? { organizationTeamId: change.organizationTeamId } : {}),
		...(change.projectId !== undefined ? { projectId: change.projectId } : {}),
		...(change.organizationTeamId !== undefined || change.projectId !== undefined
			? {
					visibilityLevel: visibilityLevelOf({
						organizationTeamId:
							change.organizationTeamId !== undefined
								? change.organizationTeamId
								: view.organizationTeamId,
						projectId: change.projectId !== undefined ? change.projectId : view.projectId
					})
				}
			: {}),
		expectedVersion: versionOf(view)
	};
}

/** The version a view was read at (a view saved before versions existed is at 1). */
export function versionOf(view: Pick<ITaskView, 'version'> | null | undefined): number {
	const version = Number(view?.version);
	return Number.isInteger(version) && version >= 1 ? version : 1;
}
