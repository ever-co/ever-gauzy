import { IOrganizationProject } from 'organization-projects.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface IOrganizationProjectTasksSettings
	extends IBasePerTenantAndOrganizationEntityModel {
	isTasksPrivacyEnabled: boolean;
	isTasksMultipleAssigneesEnabled: boolean;
	isTasksManualTimeEnabled: boolean;
	isTasksGroupEstimationEnabled: boolean;
	isTasksEstimationInHoursEnabled: boolean;
	isTasksEstimationInStoryPointsEnabled: boolean;

	isTasksProofOfCompletionEnabled: boolean;
	tasksProofOfCompletionType: string; // ENUM PUBLIC | PRIVATE

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

export interface IOrganizationProjectTasksSettingsUpdateInput {
	isTasksPrivacyEnabled: boolean;
	isTasksMultipleAssigneesEnabled: boolean;
	isTasksManualTimeEnabled: boolean;
	isTasksGroupEstimationEnabled: boolean;
	isTasksEstimationInHoursEnabled: boolean;
	isTasksEstimationInStoryPointsEnabled: boolean;

	isTasksProofOfCompletionEnabled: boolean;
	tasksProofOfCompletionType: string; // ENUM PUBLIC | PRIVATE

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
