import { ucFirst } from '@gauzy/common';
import { ITaskSize, TaskSizeEnum } from '@gauzy/contracts';

export const DEFAULT_GLOBAL_SIZES: ITaskSize[] = [
	{
		name: ucFirst(TaskSizeEnum.X_LARGE),
		value: TaskSizeEnum.X_LARGE,
		description: 'Larger size then medium Size',
		icon: null,
		color: '#F5B8B8',
		isSystem: true,
	},
    {
		name: ucFirst(TaskSizeEnum.LARGE),
		value: TaskSizeEnum.LARGE,
		description: 'Bigger size than average.',
		icon: null,
		color: '#F3D8B0',
		isSystem: true,
	},
    {
		name: ucFirst(TaskSizeEnum.MEDIUM),
		value: TaskSizeEnum.MEDIUM,
		description: 'Neither large nor small.',
		icon: null,
		color: '#F5F1CB',
		isSystem: true,
	},
    {
		name: ucFirst(TaskSizeEnum.SMALL),
		value: TaskSizeEnum.SMALL,
		description: 'Little size or slight dimensions.',
		icon: null,
		color: '#B8D1F5',
		isSystem: true,
	},
    {
		name: ucFirst(TaskSizeEnum.TINY),
		value: TaskSizeEnum.TINY,
		description: 'Below average in size.',
		icon: null,
		color: '#ECE8FC',
		isSystem: true,
	},
];
