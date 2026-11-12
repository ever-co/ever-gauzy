import {
	ITaskAutomationTemplate,
	TaskAutomationActionEnum,
	TaskAutomationConditionEnum,
	TaskAutomationStatusCategoryEnum,
	TaskAutomationTriggerEnum,
	TaskPriorityEnum
} from '@gauzy/contracts';

/**
 * The built-in templates (spec FR-3). A rule created from one is an ordinary rule: it copies the template's trigger,
 * conditions and actions, and keeps the key for display only. The names are the English defaults; the apps show
 * their own translations by key.
 */
export const TASK_AUTOMATION_TEMPLATES: readonly ITaskAutomationTemplate[] = Object.freeze([
	{
		key: 'close-parent-when-subtasks-done',
		name: 'Close the parent when all sub-tasks are done',
		description: 'When the last open sub-task of a task is done, the task moves to the first done status of its project.',
		trigger: { type: TaskAutomationTriggerEnum.ALL_SUBTASKS_DONE },
		conditions: [{ type: TaskAutomationConditionEnum.IS_OPEN }],
		actions: [{ type: TaskAutomationActionEnum.SET_STATUS, category: TaskAutomationStatusCategoryEnum.DONE }]
	},
	{
		key: 'reopen-parent-when-subtask-reopens',
		name: 'Reopen the parent when a sub-task reopens',
		description: 'When a done sub-task of a done task is reopened, the task moves to the first in-progress status of its project.',
		trigger: { type: TaskAutomationTriggerEnum.SUBTASK_REOPENED },
		conditions: [{ type: TaskAutomationConditionEnum.IS_DONE }],
		actions: [{ type: TaskAutomationActionEnum.SET_STATUS, category: TaskAutomationStatusCategoryEnum.IN_PROGRESS }]
	},
	{
		key: 'status-sets-fields',
		name: 'When the status changes, set the assignee, label or priority',
		description: 'When a task moves to the statuses you choose, set its priority, add labels or assign people.',
		trigger: { type: TaskAutomationTriggerEnum.STATUS_CHANGED, toStatuses: [] },
		conditions: [],
		actions: [{ type: TaskAutomationActionEnum.SET_PRIORITY, priority: TaskPriorityEnum.HIGH }],
		needsInput: true
	},
	{
		key: 'assigned-moves-in-progress',
		name: 'When a task is assigned, move it to In progress',
		description: 'When someone is added as an assignee of a to-do task, the task moves to the first in-progress status of its project.',
		trigger: { type: TaskAutomationTriggerEnum.TASK_ASSIGNED },
		conditions: [{ type: TaskAutomationConditionEnum.STATUS_CATEGORY_IS, values: [TaskAutomationStatusCategoryEnum.TODO] }],
		actions: [{ type: TaskAutomationActionEnum.SET_STATUS, category: TaskAutomationStatusCategoryEnum.IN_PROGRESS }]
	},
	{
		key: 'due-date-notify-assignees',
		name: 'When the due date passes, notify the assignees',
		description: 'When the due date of an open task passes, each assignee gets one notice in the Inbox.',
		trigger: { type: TaskAutomationTriggerEnum.DUE_DATE_PASSED },
		conditions: [{ type: TaskAutomationConditionEnum.IS_ASSIGNED }],
		actions: [{ type: TaskAutomationActionEnum.NOTIFY_ASSIGNEES }]
	},
	{
		key: 'link-closed-sets-status',
		name: 'When a linked pull request or issue closes, set the status',
		description: 'When an integration reports that a pull request or issue linked to an open task closed, the task moves to the first done status of its project.',
		trigger: { type: TaskAutomationTriggerEnum.LINK_CLOSED },
		conditions: [{ type: TaskAutomationConditionEnum.IS_OPEN }],
		actions: [{ type: TaskAutomationActionEnum.SET_STATUS, category: TaskAutomationStatusCategoryEnum.DONE }],
		requiresIntegration: true
	}
] as ITaskAutomationTemplate[]);

/** A template by key, as a fresh copy (a caller may change what it gets). */
export function templateByKey(key: string | null | undefined): ITaskAutomationTemplate | undefined {
	const template = TASK_AUTOMATION_TEMPLATES.find((candidate) => candidate.key === key);
	return template ? (JSON.parse(JSON.stringify(template)) as ITaskAutomationTemplate) : undefined;
}
