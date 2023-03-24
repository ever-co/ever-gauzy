import { ITaskStatus, TaskStatusEnum } from '@gauzy/contracts';

export const DEFAULT_GLOBAL_STATUSES: ITaskStatus[] = [
	{
		name: TaskStatusEnum.OPEN,
		value: TaskStatusEnum.OPEN,
		description: 'The issue/task has been reported and is waiting for the team to action it.',
		icon: 'task-statuses/open.svg',
		color: '#D6E4F9',
		isSystem: true,
	},
	{
		name: TaskStatusEnum.IN_PROGRESS,
		value: TaskStatusEnum.IN_PROGRESS,
		description: 'This issue/task is being actively worked on at the moment by the assignee.',
		icon: 'task-statuses/in-progress.svg',
		color: '#ECE8FC',
		isSystem: true,
	},
	{
		name: TaskStatusEnum.READY_FOR_REVIEW,
		value: TaskStatusEnum.READY_FOR_REVIEW,
		description: 'At this point the merge request / pull request is ready to be reviewed for issue/task.',
		icon: 'task-statuses/ready.svg',
		color: '#F5F1CB',
		isSystem: true,
	},
	{
		name: TaskStatusEnum.IN_REVIEW,
		value: TaskStatusEnum.IN_REVIEW,
		description: 'It needs peer review issue/task before being considered done.',
		icon: 'task-statuses/in-review.svg',
		color: '#F3D8B0',
		isSystem: true,
	},
	{
		name: TaskStatusEnum.BLOCKED,
		value: TaskStatusEnum.BLOCKED,
		description: 'The issue/task is missing information, wait for customer decision, etc.',
		icon: 'task-statuses/blocked.svg',
		color: '#F5B8B8',
		isSystem: true,
	},
	{
		name: TaskStatusEnum.COMPLETED,
		value: TaskStatusEnum.COMPLETED,
		description: 'The issue/task is considered finished. The resolution is correct.',
		icon: 'task-statuses/completed.svg',
		color: '#D4EFDF',
		isSystem: true,
	},
];
