import { IStatus, TaskStatusEnum } from '@gauzy/contracts';

export const DEFAULT_GLOBAL_STATUSES: IStatus[] = [
	{
		name: TaskStatusEnum.OPEN,
		value: TaskStatusEnum.OPEN,
		description:
			'The issue/task has been reported and is waiting for the team to action it.',
		icon: null,
		color: '#f7f9fc',
		isSystem: true,
	},
	{
		name: TaskStatusEnum.IN_PROGRESS,
		value: TaskStatusEnum.IN_PROGRESS,
		description:
			'This issue/task is being actively worked on at the moment by the assignee.',
		icon: null,
		color: '#0095ff',
		isSystem: true,
	},
	{
		name: TaskStatusEnum.READY_FOR_REVIEW,
		value: TaskStatusEnum.READY_FOR_REVIEW,
		description:
			'At this point the merge request / pull request is ready to be reviewed for issue/task.',
		icon: null,
		color: '#0095ff',
		isSystem: true,
	},
	{
		name: TaskStatusEnum.IN_REVIEW,
		value: TaskStatusEnum.IN_REVIEW,
		description:
			'It needs peer review issue/task before being considered done.',
		icon: null,
		color: '#0095ff',
		isSystem: true,
	},
	{
		name: TaskStatusEnum.BLOCKED,
		value: TaskStatusEnum.BLOCKED,
		description:
			'The issue/task is missing information, wait for customer decision, etc.',
		icon: null,
		color: '#ff0000',
		isSystem: true,
	},
	{
		name: TaskStatusEnum.COMPLETED,
		value: TaskStatusEnum.COMPLETED,
		description:
			'The issue/task is considered finished. The resolution is correct.',
		icon: null,
		color: '#00d68f',
		isSystem: true,
	},
];
