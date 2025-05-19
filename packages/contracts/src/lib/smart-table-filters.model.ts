import { ITaskStatus } from './task-status.model';

export interface CustomFilterConfig {
	initialValueInput?: string;
	initialValueStatus?: ITaskStatus;
	initialValueIds?: string[];
}
