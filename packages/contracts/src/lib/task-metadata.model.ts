import { ID } from './base-entity.model';
import { IPagination } from './core.model';
import { IIssueType } from './issue-type.model';
import { ITag } from './tag.model';
import { ITaskPriority } from './task-priority.model';
import { ITaskRelatedIssueType } from './task-related-issue-type.model';
import { ITaskSize } from './task-size.model';
import { ITaskStatus } from './task-status.model';
import { ITaskVersion } from './task-version.model';

export const TASK_METADATA_SECTIONS = [
	'taskStatuses',
	'taskPriorities',
	'taskSizes',
	'taskLabels',
	'taskVersions',
	'issueTypes',
	'relatedIssueTypes'
] as const;

export type TaskMetadataSection = (typeof TASK_METADATA_SECTIONS)[number];

export interface ITaskMetadataBootstrapQuery {
	organizationId: ID;
	organizationTeamId?: ID;
	projectId?: ID;
	include?: TaskMetadataSection[];
}

export interface ITaskMetadataBootstrapResponse {
	taskStatuses?: IPagination<ITaskStatus>;
	taskPriorities?: IPagination<ITaskPriority>;
	taskSizes?: IPagination<ITaskSize>;
	taskLabels?: IPagination<ITag>;
	taskVersions?: IPagination<ITaskVersion>;
	issueTypes?: IPagination<IIssueType>;
	relatedIssueTypes?: IPagination<ITaskRelatedIssueType>;
}
