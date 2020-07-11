import { ComponentLayoutStyleEnum } from '@gauzy/models';

export enum ComponentEnum {
	ALL_TASKS = 'ALL_TASKS',
	MY_TASKS = 'MY_TASKS',
	TEAM_TASKS = 'TEAM_TASKS',
	ESTIMATES = 'ESTIMATES',
	INCOME = 'INCOME'
}

export const SYSTEM_DEFAULT_LAYOUT = ComponentLayoutStyleEnum.TABLE;
