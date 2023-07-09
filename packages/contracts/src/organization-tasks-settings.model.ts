import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface IOrganizationTasksSettings
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
}

export enum TasksProofOfCompletionTypeEnum {
	PUBLIC = 'PUBLIC',
	PRIVATE = 'PRIVATE',
}

export interface IOrganizationTasksSettingsUpdateInput {
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
