import { TaskProofOfCompletionTypeEnum } from '@gauzy/constants';
import { IRelationalOrganizationProject } from './organization-projects.model';
import { IRelationalOrganizationTeam } from './organization-team.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface IOrganizationTaskSetting
	extends IBasePerTenantAndOrganizationEntityModel,
		IRelationalOrganizationTeam,
		IRelationalOrganizationProject {
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

export interface IOrganizationTaskSettingFindInput
	extends IBasePerTenantAndOrganizationEntityModel,
		IRelationalOrganizationTeam,
		IRelationalOrganizationProject {}

export interface IOrganizationTaskSettingCreateInput extends IOrganizationTaskSetting {}

export interface IOrganizationTaskSettingUpdateInput extends Partial<IOrganizationTaskSettingCreateInput> {}
