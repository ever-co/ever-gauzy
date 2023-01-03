import { BaseTO } from './base.dto';
import { TagTO } from './tag.dto';
import { UserTO } from './user.dto';

export interface TaskTO extends BaseTO {
	creatorId: string;
	description: string;
	dueDate: string;
	estimate: number;
	members: UserTO[];
	projectId: string;
	status: string;
	tags: TagTO[];
	title: string;
	taskNumber: string;
}
export const TABLE_NAME_TASKS = 'tasks';
