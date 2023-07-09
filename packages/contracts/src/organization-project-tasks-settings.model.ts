import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IOrganizationProject, IRelationalOrganizationProject } from './organization-projects.model';
import { TasksProofOfCompletionTypeEnum } from './organization-tasks-settings.model';

export interface IOrganizationProjectTasksSettings
	extends IBasePerTenantAndOrganizationEntityModel {
	isTasksPrivacyEnabled: boolean;
	isTasksMultipleAssigneesEnabled: boolean;
	isTasksManualTimeEnabled: boolean;
	isTasksGroupEstimationEnabled: boolean;
	isTasksEstimationInHoursEnabled: boolean;
	isTasksEstimationInStoryPointsEnabled: boolean;

	isTasksProofOfCompletionEnabled: boolean;
	tasksProofOfCompletionType: TasksProofOfCompletionTypeEnum; // ENUM PUBLIC | PRIVATE

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

	projectId?: string;
	project?: IOrganizationProject;
}

export interface IOrganizationProjectTasksSettingsUpdateInput extends IRelationalOrganizationProject {
	isTasksPrivacyEnabled: boolean;
	isTasksMultipleAssigneesEnabled: boolean;
	isTasksManualTimeEnabled: boolean;
	isTasksGroupEstimationEnabled: boolean;
	isTasksEstimationInHoursEnabled: boolean;
	isTasksEstimationInStoryPointsEnabled: boolean;

	isTasksProofOfCompletionEnabled: boolean;
	tasksProofOfCompletionType: TasksProofOfCompletionTypeEnum; // ENUM PUBLIC | PRIVATE

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
