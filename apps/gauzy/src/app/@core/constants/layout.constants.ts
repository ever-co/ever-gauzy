import { ComponentLayoutStyleEnum } from '@gauzy/models';

export enum ComponentEnum {
	ALL_TASKS = 'ALL_TASKS',
	MY_TASKS = 'MY_TASKS',
	TEAM_TASKS = 'TEAM_TASKS'
}

export const SYSTEM_DEFAULT_LAYOUT = ComponentLayoutStyleEnum.TABLE;
