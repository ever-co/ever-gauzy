import { ITaskVersion, TaskVersionEnum } from '@gauzy/contracts';

export const DEFAULT_GLOBAL_VERSIONS: ITaskVersion[] = [
	{
		name: TaskVersionEnum.VERSION_ONE,
		value: TaskVersionEnum.VERSION_ONE,
		description: 'Version 1',
		icon: null,
		color: '#FFFFFF',
		isSystem: true,
	},
	{
		name: TaskVersionEnum.VERSION_TWO,
		value: TaskVersionEnum.VERSION_TWO,
		description: 'Version 2',
		icon: null,
		color: '#FFFFFF',
		isSystem: true,
	},
	{
		name: TaskVersionEnum.VERSION_THREE,
		value: TaskVersionEnum.VERSION_THREE,
		description: 'Version 3',
		icon: null,
		color: '#FFFFFF',
		isSystem: true,
	},
	{
		name: TaskVersionEnum.VERSION_FOUR,
		value: TaskVersionEnum.VERSION_FOUR,
		description: 'Version 4',
		icon: null,
		color: '#FFFFFF',
		isSystem: true,
	},
];
