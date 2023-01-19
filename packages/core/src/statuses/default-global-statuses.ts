import { IStatus, TaskStatusEnum } from '@gauzy/contracts';
import slugify from 'slugify';

export const DEFAULT_GLOBAL_STATUSES: IStatus[] = [
	{
		name: TaskStatusEnum.OPEN,
		value: slugify(TaskStatusEnum.OPEN, '_').toLocaleLowerCase(),
		description:
			'The issue/task has been reported and is waiting for the team to action it.',
		icon: null,
		color: '#f7f9fc',
		isSystem: true,
	},
	{
		name: TaskStatusEnum.IN_PROGRESS,
		value: slugify(TaskStatusEnum.IN_PROGRESS, '_').toLocaleLowerCase(),
		description:
			'This issue/task is being actively worked on at the moment by the assignee.',
		icon: null,
		color: '#0095ff',
		isSystem: true,
	},
	{
		name: TaskStatusEnum.READY_FOR_REVIEW,
		value: slugify(TaskStatusEnum.READY_FOR_REVIEW, '_').toLocaleLowerCase(),
		description:
			'At this point the merge request / pull request is ready to be reviewed for issue/task.',
		icon: null,
		color: '#0095ff',
		isSystem: true,
	},
	{
		name: TaskStatusEnum.IN_REVIEW,
		value: slugify(TaskStatusEnum.IN_REVIEW, '_').toLocaleLowerCase(),
		description:
			'It needs peer review issue/task before being considered done.',
		icon: null,
		color: '#0095ff',
		isSystem: true,
	},
	{
		name: TaskStatusEnum.BLOCKED,
		value: slugify(TaskStatusEnum.BLOCKED, '_').toLocaleLowerCase(),
		description:
			'The issue/task is missing information, wait for customer decision, etc.',
		icon: null,
		color: '#ff0000',
		isSystem: true,
	},
	{
		name: TaskStatusEnum.COMPLETED,
		value: slugify(TaskStatusEnum.COMPLETED, '_').toLocaleLowerCase(),
		description:
			'The issue/task is considered finished. The resolution is correct.',
		icon: null,
		color: '#00d68f',
		isSystem: true,
	},
];
