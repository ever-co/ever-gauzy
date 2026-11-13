import { ITaskAutomationCatalog, ITaskAutomationStatusRow, ITaskAutomationTaskSnapshot } from '../task-snapshot';

/** An organization's statuses: the defaults with workflow flags, a project's own done status, a custom one. */
export const STATUSES: ITaskAutomationStatusRow[] = [
	{ id: 'st-open', value: 'open', name: 'Open', projectId: null, order: 1, isTodo: true },
	{ id: 'st-progress', value: 'in-progress', name: 'In Progress', projectId: null, order: 2, isInProgress: true },
	{ id: 'st-review', value: 'ready-for-review', name: 'Ready for review', projectId: null, order: 3 },
	{ id: 'st-done', value: 'done', name: 'Done', projectId: null, order: 5, isDone: true },
	{ id: 'st-completed', value: 'completed', name: 'Completed', projectId: null, order: 6 },
	{ id: 'st-cancelled', value: 'cancelled', name: 'Cancelled', projectId: null, order: 7 },
	{ id: 'st-shipped', value: 'shipped', name: 'Shipped', projectId: 'project-web', order: 4, isDone: true },
	{ id: 'st-custom', value: 'waiting', name: 'Waiting', projectId: null, order: 8 }
];

export const CATALOG: ITaskAutomationCatalog = {
	statuses: STATUSES,
	priorities: [
		{ id: 'pr-high', value: 'high', name: 'High', projectId: null },
		{ id: 'pr-low', value: 'low', name: 'Low', projectId: null }
	]
};

/** A task of organization `org-1`, open, unassigned, unlabelled, in no project, unless the overrides say. */
export function task(overrides: Partial<ITaskAutomationTaskSnapshot> = {}): ITaskAutomationTaskSnapshot {
	return {
		id: 'task-1',
		tenantId: 'tenant-1',
		organizationId: 'org-1',
		projectId: null,
		teamIds: [],
		title: 'Ship the release notes',
		status: 'open',
		taskStatusId: 'st-open',
		priority: null,
		taskPriorityId: null,
		memberIds: [],
		tagIds: [],
		parentId: null,
		dueDate: null,
		...overrides
	};
}
