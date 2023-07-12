import { IBasePerTenantAndOrganizationEntityModel } from "./base-entity.model";
import { ITask } from "./task.model";

export enum TaskRelatedIssuesRelationEnum {
    IS_BLOCKED_BY = 1,
    BLOCKS = 2,
    IS_CLONED_BY = 3,
    CLONES = 4,
    IS_DUPLICATED_BY = 5,
    DUPLICATES = 6,
    RELATES_TO = 7
}

export interface ITaskLinkedIssue extends IBasePerTenantAndOrganizationEntityModel {
    action: TaskRelatedIssuesRelationEnum;
    taskFrom: ITask;
    taskFromId: ITask['id'];
    taskTo: ITask;
    taskToId: ITask['id'];
}
