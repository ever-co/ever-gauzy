export * from './base-entity-event.subscriber';
export * from './tenant-organization-base-entity.subscriber';

import { MultiORMEnum, getORMType } from '../../utils';
import {
	ActivitySubscriber,
	CandidateSubscriber,
	CustomSmtpSubscriber,
	EmailResetSubscriber,
	EmailTemplateSubscriber,
	EmployeeSubscriber,
	FeatureSubscriber,
	ImageAssetSubscriber,
	ImportHistorySubscriber,
	IntegrationSettingSubscriber,
	IntegrationSubscriber,
	InviteSubscriber,
	InvoiceSubscriber,
	IssueTypeSubscriber,
	OrganizationContactSubscriber,
	OrganizationDocumentSubscriber,
	OrganizationProjectSubscriber,
	OrganizationSubscriber,
	OrganizationTeamEmployeeSubscriber,
	OrganizationTeamJoinRequestSubscriber,
	OrganizationTeamSubscriber,
	PaymentSubscriber,
	PipelineSubscriber,
	ProductCategorySubscriber,
	ReportSubscriber,
	RoleSubscriber,
	ScreenshotSubscriber,
	TagSubscriber,
	TaskPrioritySubscriber,
	TaskRelatedIssueTypeSubscriber,
	TaskSizeSubscriber,
	TaskStatusSubscriber,
	TaskSubscriber,
	TaskVersionSubscriber,
	TenantSubscriber,
	TimeOffRequestSubscriber,
	TimeSlotSubscriber,
	UserSubscriber
} from '../internal';
import { TenantOrganizationBaseEntityEventSubscriber } from './tenant-organization-base-entity.subscriber';

const ormType = getORMType();

/**
 * A map of the core TypeORM / MikroORM Subscribers.
 */
export const coreSubscribers = [
	// Conditionally add TenantOrganizationBaseEntityEventSubscriber if ORM is MikroORM
	...(ormType === MultiORMEnum.MikroORM ? [TenantOrganizationBaseEntityEventSubscriber] : []), // Add the subscriber only if the ORM type is MikroORM
	ActivitySubscriber,
	CandidateSubscriber,
	CustomSmtpSubscriber,
	EmailResetSubscriber,
	EmailTemplateSubscriber,
	EmployeeSubscriber,
	FeatureSubscriber,
	ImageAssetSubscriber,
	ImportHistorySubscriber,
	IntegrationSettingSubscriber,
	IntegrationSubscriber,
	InviteSubscriber,
	InvoiceSubscriber,
	IssueTypeSubscriber,
	OrganizationContactSubscriber,
	OrganizationDocumentSubscriber,
	OrganizationProjectSubscriber,
	OrganizationSubscriber,
	OrganizationTeamEmployeeSubscriber,
	OrganizationTeamJoinRequestSubscriber,
	OrganizationTeamSubscriber,
	PaymentSubscriber,
	PipelineSubscriber,
	ProductCategorySubscriber,
	ReportSubscriber,
	RoleSubscriber,
	ScreenshotSubscriber,
	TagSubscriber,
	TaskPrioritySubscriber,
	TaskRelatedIssueTypeSubscriber,
	TaskSizeSubscriber,
	TaskStatusSubscriber,
	TaskSubscriber,
	TaskVersionSubscriber,
	TenantSubscriber,
	TimeOffRequestSubscriber,
	TimeSlotSubscriber,
	UserSubscriber
];
