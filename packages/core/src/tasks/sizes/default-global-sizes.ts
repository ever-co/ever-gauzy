import { ucFirst } from '@gauzy/common';
import { ITaskSize, TaskSizeEnum } from '@gauzy/contracts';

export const DEFAULT_GLOBAL_SIZES: ITaskSize[] = [
	{
		name: ucFirst(TaskSizeEnum.X_LARGE),
		value: TaskSizeEnum.X_LARGE,
		description: 'Larger size then medium Size',
		icon: null,
		color: '#ff3d71',
		isSystem: true,
	},
	{
		name: ucFirst(TaskSizeEnum.LARGE),
		value: TaskSizeEnum.LARGE,
		description: 'Bigger size than average.',
		icon: null,
		color: '#ffaa00',
		isSystem: true,
	},
	{
		name: ucFirst(TaskSizeEnum.MEDIUM),
		value: TaskSizeEnum.MEDIUM,
		description: 'Neither large nor small.',
		icon: null,
		color: '#0095ff',
		isSystem: true,
	},
	{
		name: ucFirst(TaskSizeEnum.SMALL),
		value: TaskSizeEnum.SMALL,
		description: 'Little size or slight dimensions.',
		icon: null,
		color: '#3366ff',
		isSystem: true,
	},
	{
		name: ucFirst(TaskSizeEnum.TINY),
		value: TaskSizeEnum.TINY,
		description: 'Below average in size.',
		icon: null,
		color: '#f7f9fc',
		isSystem: true,
	},
];
