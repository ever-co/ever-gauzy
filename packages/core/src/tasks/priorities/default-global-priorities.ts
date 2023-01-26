import { ucFirst } from '@gauzy/common';
import { ITaskPriority, TaskPriorityEnum } from '@gauzy/contracts';

export const DEFAULT_GLOBAL_PRIORITIES: ITaskPriority[] = [
	{
		name: ucFirst(TaskPriorityEnum.URGENT),
		value: TaskPriorityEnum.URGENT,
		description: 'If something is urgent, it needs to be dealt with as soon as possible.',
		icon: null,
		color: '#ff0000',
		isSystem: true,
	},
	{
		name: ucFirst(TaskPriorityEnum.HIGH),
		value: TaskPriorityEnum.HIGH,
		description: 'You can use high to indicate that something is great in amount, degree, or intensity.',
		icon: null,
		color: '#ffaa00',
		isSystem: true,
	},
	{
		name: ucFirst(TaskPriorityEnum.MEDIUM),
		value: TaskPriorityEnum.MEDIUM,
		description: 'An isolated issue (one agency, small subset of events) that prevents import, search, or export of events or cases.',
		icon: null,
		color: '#3366ff',
		isSystem: true,
	},
	{
		name: ucFirst(TaskPriorityEnum.LOW),
		value: TaskPriorityEnum.LOW,
		description: 'There is a significant problem but it is not, at least yet, significantly affecting your operations.',
		icon: null,
		color: '#00d68f',
		isSystem: true,
	},
];
