import { ucFirst } from '@gauzy/utils';
import { ITaskSize, TaskSizeEnum } from '@gauzy/contracts';

export const DEFAULT_GLOBAL_SIZES: ITaskSize[] = [
	{
		name: ucFirst(TaskSizeEnum.X_LARGE),
		value: TaskSizeEnum.X_LARGE,
		description: 'Larger size then medium Size',
		icon: 'task-sizes/x-large.svg',
		color: '#F5B8B8',
		isSystem: true
	},
	{
		name: ucFirst(TaskSizeEnum.LARGE),
		value: TaskSizeEnum.LARGE,
		description: 'Bigger size than average.',
		icon: 'task-sizes/large.svg',
		color: '#F3D8B0',
		isSystem: true
	},
	{
		name: ucFirst(TaskSizeEnum.MEDIUM),
		value: TaskSizeEnum.MEDIUM,
		description: 'Neither large nor small.',
		icon: 'task-sizes/medium.svg',
		color: '#F5F1CB',
		isSystem: true
	},
	{
		name: ucFirst(TaskSizeEnum.SMALL),
		value: TaskSizeEnum.SMALL,
		description: 'Little size or slight dimensions.',
		icon: 'task-sizes/small.svg',
		color: '#B8D1F5',
		isSystem: true
	},
	{
		name: ucFirst(TaskSizeEnum.TINY),
		value: TaskSizeEnum.TINY,
		description: 'Below average in size.',
		icon: 'task-sizes/tiny.svg',
		color: '#ECE8FC',
		isSystem: true
	}
];
