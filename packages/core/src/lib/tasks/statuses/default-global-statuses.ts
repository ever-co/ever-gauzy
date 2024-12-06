import { ITaskStatus, TaskStatusEnum } from '@gauzy/contracts';

export const DEFAULT_GLOBAL_STATUSES: ITaskStatus[] = [
	{
		name: TaskStatusEnum.BACKLOG,
		value: TaskStatusEnum.BACKLOG,
		description: 'The issue/task has been reported and is waiting for the team to action it.',
		icon: 'task-statuses/backlog.svg',
		order: 0,
		color: '#FFCC00',
		isSystem: true,
		isCollapsed: false,
		isDefault: false,
		isTodo: true,
		isInProgress: false,
		isDone: false
	},
	{
		name: TaskStatusEnum.OPEN,
		value: TaskStatusEnum.OPEN,
		description: 'The issue/task has being processed or ready to start',
		icon: 'task-statuses/open.svg',
		order: 1,
		color: '#D6E4F9',
		isSystem: true,
		isCollapsed: false,
		isDefault: false,
		isTodo: true,
		isInProgress: false,
		isDone: false
	},
	{
		name: TaskStatusEnum.IN_PROGRESS,
		value: TaskStatusEnum.IN_PROGRESS,
		description: 'This issue/task is being actively worked on at the moment by the assignee.',
		icon: 'task-statuses/in-progress.svg',
		order: 2,
		color: '#ECE8FC',
		isSystem: true,
		isCollapsed: false,
		isDefault: false,
		isTodo: false,
		isInProgress: true,
		isDone: false
	},
	{
		name: TaskStatusEnum.READY_FOR_REVIEW,
		value: TaskStatusEnum.READY_FOR_REVIEW,
		description: 'At this point the merge request / pull request is ready to be reviewed for issue/task.',
		icon: 'task-statuses/ready.svg',
		order: 3,
		color: '#F5F1CB',
		isSystem: true,
		isCollapsed: false,
		isDefault: false,
		isTodo: false,
		isInProgress: true,
		isDone: false
	},
	{
		name: TaskStatusEnum.IN_REVIEW,
		value: TaskStatusEnum.IN_REVIEW,
		description: 'It needs peer review issue/task before being considered done.',
		icon: 'task-statuses/in-review.svg',
		order: 4,
		color: '#F3D8B0',
		isSystem: true,
		isCollapsed: false,
		isDefault: false,
		isTodo: false,
		isInProgress: true,
		isDone: false
	},
	{
		name: TaskStatusEnum.BLOCKED,
		value: TaskStatusEnum.BLOCKED,
		description: 'The issue/task is missing information, wait for customer decision, etc.',
		icon: 'task-statuses/blocked.svg',
		order: 5,
		color: '#F5B8B8',
		isSystem: true,
		isCollapsed: false,
		isDefault: false,
		isTodo: false,
		isInProgress: true,
		isDone: false
	},
	{
		name: TaskStatusEnum.DONE,
		value: TaskStatusEnum.DONE,
		description: 'The issue/task has been carried out and delivered according to specifications.',
		icon: 'task-statuses/done.svg',
		order: 6,
		color: '#4CAF50',
		isSystem: true,
		isCollapsed: false,
		isDefault: false,
		isTodo: false,
		isInProgress: false,
		isDone: true
	},
	{
		name: TaskStatusEnum.COMPLETED,
		value: TaskStatusEnum.COMPLETED,
		description: 'The issue/task is considered finished. The resolution is correct.',
		icon: 'task-statuses/completed.svg',
		order: 7,
		color: '#D4EFDF',
		isSystem: true,
		isCollapsed: false,
		isDefault: false,
		isTodo: false,
		isInProgress: false,
		isDone: true
	},
	{
		name: TaskStatusEnum.CUSTOM,
		value: TaskStatusEnum.CUSTOM,
		description: 'Custom issue type',
		icon: 'task-statuses/custom.svg',
		order: 8,
		color: '#D4EFDF',
		isSystem: true,
		isCollapsed: false,
		isDefault: false,
		isTodo: false,
		isInProgress: false,
		isDone: false
	}
];