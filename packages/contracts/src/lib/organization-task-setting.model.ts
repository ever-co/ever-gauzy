import { IRelationalOrganizationProject } from './organization-projects.model';
import { IRelationalOrganizationTeam } from './organization-team.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface IOrganizationTaskSetting extends IBasePerTenantAndOrganizationEntityModel, IRelationalOrganizationTeam, IRelationalOrganizationProject {

    isTasksPrivacyEnabled: boolean;
    isTasksMultipleAssigneesEnabled: boolean;
    isTasksManualTimeEnabled: boolean;
    isTasksGroupEstimationEnabled: boolean;
    isTasksEstimationInHoursEnabled: boolean;
    isTasksEstimationInStoryPointsEnabled: boolean;

    isTasksProofOfCompletionEnabled: boolean;
    tasksProofOfCompletionType: TaskProofOfCompletionTypeEnum;

    isTasksLinkedEnabled: boolean;
    isTasksCommentsEnabled: boolean;
    isTasksHistoryEnabled: boolean;
    isTasksAcceptanceCriteriaEnabled: boolean;
    isTasksDraftsEnabled: boolean;

    isTasksNotifyLeftEnabled: boolean;
    tasksNotifyLeftPeriodDays: number;

    isTasksAutoCloseEnabled: boolean;
    tasksAutoClosePeriodDays: number;

    isTasksAutoArchiveEnabled: boolean;
    tasksAutoArchivePeriodDays: number;

    isTasksAutoStatusEnabled: boolean;
}

export enum TaskProofOfCompletionTypeEnum {
    PUBLIC = 'PUBLIC',
    PRIVATE = 'PRIVATE',
}

export interface IOrganizationTaskSettingFindInput extends IBasePerTenantAndOrganizationEntityModel, IRelationalOrganizationTeam, IRelationalOrganizationProject { }

export interface IOrganizationTaskSettingCreateInput extends IOrganizationTaskSetting { }

export interface IOrganizationTaskSettingUpdateInput extends Partial<IOrganizationTaskSettingCreateInput> {
    id?: IOrganizationTaskSetting['id'];
}

export const DEFAULT_TASK_NOTIFY_PERIOD = 7;
export const DEFAULT_AUTO_CLOSE_ISSUE_PERIOD = 7;
export const DEFAULT_AUTO_ARCHIVE_ISSUE_PERIOD = 7;
export const DEFAULT_PROOF_COMPLETION_TYPE = TaskProofOfCompletionTypeEnum.PRIVATE;
