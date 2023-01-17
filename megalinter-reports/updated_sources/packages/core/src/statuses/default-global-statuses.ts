import { IStatus, TaskStatusEnum } from '@gauzy/contracts';

export const DEFAULT_GLOBAL_STATUSES: IStatus[] = [
	{
		name: TaskStatusEnum.TODO,
		value: TaskStatusEnum.TODO,
		description:
			'The issue/task has been reported and is waiting for the team to action it.',
		icon: null,
		color: '#ffab2d',
		isSystem: true,
	},
	{
		name: TaskStatusEnum.IN_PROGRESS,
		value: TaskStatusEnum.IN_PROGRESS,
		description:
			'This issue is being actively worked on at the moment by the assignee.',
		icon: null,
		color: '#0095ff',
		isSystem: true,
	},
	{
		name: TaskStatusEnum.FOR_TESTING,
		value: TaskStatusEnum.FOR_TESTING,
		description: 'It needs peer review before being considered done.',
		icon: null,
		color: '#222b45',
		isSystem: true,
	},
	{
		name: TaskStatusEnum.COMPLETED,
		value: TaskStatusEnum.COMPLETED,
		description:
			'The issue is considered finished. The resolution is correct.',
		icon: null,
		color: '#00d68f',
		isSystem: true,
	},
];
