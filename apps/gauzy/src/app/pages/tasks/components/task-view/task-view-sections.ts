import { ITask, TaskPriorityEnum, TaskStatusEnum } from '@gauzy/contracts';
import { IRecordViewSection, IRecordViewStatus } from '@gauzy/ui-core/shared';

/**
 * The read-only description of one task, shared by its two View surfaces: the right-side drawer of the
 * task lists (a quick look) and the full-width task page `/pages/tasks/view/:id` (a bookmarkable,
 * shareable URL — handover §4.P). Both render exactly these sections, so a task reads the same in either.
 */

/** Relations the View reads. The page loads the task with these; the lists already load them. */
export const TASK_VIEW_RELATIONS: string[] = [
	'members',
	'members.user',
	'project',
	'parent',
	'tags',
	'teams',
	'teams.members',
	'teams.members.employee',
	'teams.members.employee.user',
	'createdByUser',
	'organizationSprint',
	'taskStatus',
	'taskSize',
	'taskPriority'
];

export interface ITaskViewText {
	/** Translates an i18n key (the estimate's day / hour / minute units). */
	translate: (key: string) => string;
	/** Formats a task number the way the grid does (`#12`). */
	hash: (value: number | string) => string;
}

/**
 * Whether the task is in a terminal state, so a past due date is no longer a
 * problem. A tenant status carries its own `isDone` flag; otherwise either the
 * enum value or the status row's name may say it, in any casing ("Done",
 * "Completed", "cancelled").
 */
export function isTaskFinished(task: ITask): boolean {
	if (task.taskStatus?.isDone) {
		return true;
	}
	const finished = new Set<string>([TaskStatusEnum.COMPLETED, TaskStatusEnum.DONE, TaskStatusEnum.CANCELLED]);
	const normalize = (value?: string) => value?.trim().toLowerCase().replace(/\s+/g, '-');
	return [task.status, task.taskStatus?.name].some((value) => finished.has(normalize(value)));
}

/**
 * Status for the header lozenge and the Details row. Text prefers the named
 * relation the list already loads; the tenant's own colour wins over the tone.
 */
export function taskStatusOf(task: ITask): IRecordViewStatus {
	const raw = task.taskStatus?.name || task.status;
	if (!raw) {
		return null;
	}
	// A standard status arrives as its enum slug ('in-progress'); a tenant one is already a name.
	const text = raw.replace(/-/g, ' ');
	const color = task.taskStatus?.color;
	switch (task.status) {
		case TaskStatusEnum.COMPLETED:
		case TaskStatusEnum.DONE:
			return { text, color, tone: 'success' };
		case TaskStatusEnum.BLOCKED:
		case TaskStatusEnum.CANCELLED:
			return { text, color, tone: 'danger' };
		case TaskStatusEnum.IN_PROGRESS:
		case TaskStatusEnum.READY_FOR_REVIEW:
		case TaskStatusEnum.IN_REVIEW:
			return { text, color, tone: 'info' };
		default:
			return { text, color, tone: 'basic' };
	}
}

export function taskPriorityOf(task: ITask): IRecordViewStatus {
	const text = task.taskPriority?.name || task.priority;
	if (!text) {
		return null;
	}
	const color = task.taskPriority?.color;
	switch (task.priority) {
		case TaskPriorityEnum.URGENT:
			return { text, color, tone: 'danger', icon: 'arrowhead-up-outline' };
		case TaskPriorityEnum.HIGH:
			return { text, color, tone: 'warning', icon: 'arrow-upward-outline' };
		case TaskPriorityEnum.LOW:
			return { text, color, tone: 'success', icon: 'arrow-downward-outline' };
		default:
			return { text, color, tone: 'info', icon: 'minus-outline' };
	}
}

export function taskSizeOf(task: ITask): IRecordViewStatus {
	const text = task.taskSize?.name || task.size;
	return text ? { text, color: task.taskSize?.color, tone: 'primary' } : null;
}

/**
 * Estimate is stored as seconds (see the task dialogs); decompose it the way
 * the task dialogs do — days / hours / minutes — skipping the zero parts.
 */
export function formatTaskEstimate(estimate: number, translate: ITaskViewText['translate']): string {
	if (!estimate) {
		return null;
	}
	const days = Math.floor(estimate / (24 * 60 * 60));
	const hours = Math.floor((estimate % (24 * 60 * 60)) / (60 * 60));
	const minutes = Math.floor((estimate % (60 * 60)) / 60);
	return [
		days ? `${days} ${translate('TASKS_PAGE.ESTIMATE_DAYS')}` : null,
		hours ? `${hours} ${translate('TASKS_PAGE.ESTIMATE_HOURS')}` : null,
		minutes ? `${minutes} ${translate('TASKS_PAGE.ESTIMATE_MINUTES')}` : null
	]
		.filter(Boolean)
		.join(' ');
}

/**
 * Field descriptor for a task's View. Key, title, project and status are in the
 * projected header; everything else is a Details panel of people then
 * planning, the description as prose, and the created / updated stamps.
 */
export function buildTaskViewSections(task: ITask, text: ITaskViewText): IRecordViewSection[] {
	// `taskNumber` is a server-side virtual column (prefix + number), absent
	// from ITask — the same shape the grid's valuePrepareFunction reads.
	const { parent } = task as any;
	const isOverdue = !!task.dueDate && !isTaskFinished(task) && new Date(task.dueDate).getTime() < Date.now();
	const parentLabel = parent?.taskNumber
		? [text.hash(parent.taskNumber), parent.title].filter(Boolean).join('  ')
		: null;

	return [
		{
			title: 'BUTTONS.DETAILS',
			icon: 'info-outline',
			collapsible: true,
			fields: [
				// People
				{
					label: 'TASKS_PAGE.TASK_MEMBERS',
					key: 'members',
					type: 'people',
					icon: 'people-outline',
					showWhenEmpty: true
				},
				{ label: 'TASKS_PAGE.TASK_TEAMS', key: 'teams', type: 'teams', icon: 'briefcase-outline' },
				{ label: 'TASKS_PAGE.TASKS_CREATOR', key: 'createdByUser', type: 'person', icon: 'edit-2-outline' },
				// Planning
				{
					label: 'TASKS_PAGE.TASKS_STATUS',
					type: 'status',
					value: taskStatusOf(task),
					icon: 'checkmark-circle-2-outline',
					divider: true
				},
				{
					label: 'TASKS_PAGE.TASK_PRIORITY',
					type: 'status',
					value: taskPriorityOf(task),
					icon: 'flag-outline',
					showWhenEmpty: true
				},
				{ label: 'TASKS_PAGE.TASK_SIZE', type: 'status', value: taskSizeOf(task), icon: 'maximize-outline' },
				{
					label: 'TASKS_PAGE.DUE_DATE',
					key: 'dueDate',
					type: 'date',
					icon: 'calendar-outline',
					tone: isOverdue ? 'danger' : undefined,
					showWhenEmpty: true
				},
				{
					label: 'TASKS_PAGE.ESTIMATE',
					value: formatTaskEstimate(task.estimate, text.translate),
					icon: 'clock-outline'
				},
				{ label: 'SPRINTS_PAGE.SPRINT', key: 'organizationSprint.name', icon: 'flash-outline' },
				{ label: 'TASKS_PAGE.TASKS_PROJECT', key: 'project.name', icon: 'folder-outline' },
				{ label: 'TASKS_PAGE.PARENT_TASK', value: parentLabel, icon: 'corner-left-up-outline' },
				{ label: 'SM_TABLE.TAGS', key: 'tags', type: 'tags', icon: 'pricetags-outline', showWhenEmpty: true }
			]
		},
		{
			title: 'TASKS_PAGE.TASKS_DESCRIPTION',
			icon: 'file-text-outline',
			variant: 'plain',
			fields: [
				{
					label: 'TASKS_PAGE.TASKS_DESCRIPTION',
					key: 'description',
					type: 'markdown',
					hideLabel: true,
					showWhenEmpty: true
				}
			]
		},
		{
			variant: 'meta',
			fields: [
				{ label: 'SM_TABLE.CREATED_AT', key: 'createdAt', type: 'datetime', icon: 'plus-circle-outline' },
				{ label: 'SM_TABLE.LAST_UPDATED', key: 'updatedAt', type: 'datetime', icon: 'refresh-outline' }
			]
		}
	];
}
