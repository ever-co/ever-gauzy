import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { LanguagesEnum } from './user.model';

export interface IRelationalEmailTemplate {
	emailTemplate: IEmailTemplate;
	emailTemplateId: IEmailTemplate['id'];
}

export interface IEmailTemplate extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	mjml: string;
	hbs: string;
	languageCode: string;
	title?: string;
}

export interface IEmailTemplateFindInput extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	languageCode?: string;
}

export enum EmailTemplateEnum {
	PASSWORD_RESET = 'password',
	MULTI_TENANT_PASSWORD_RESET = 'multi-tenant-password',
	PASSWORD_LESS_AUTHENTICATION = 'password-less-authentication',
	APPOINTMENT_CONFIRMATION = 'appointment-confirmation',
	APPOINTMENT_CANCELLATION = 'appointment-cancellation',
	TIME_OFF_POLICY_ACTION = 'time-off-report-action',
	TASK_UPDATE = 'task-update',
	EQUIPMENT = 'equipment',
	EQUIPMENT_REQUEST = 'equipment-request',
	TIME_SHEET_OVERVIEW = 'timesheet-overview',
	TIME_SHEET_SUBMIT = 'timesheet-submit',
	TIME_SHEET_ACTION = 'timesheet-action',
	TIME_SHEET_DELETE = 'timesheet-delete',
	CANDIDATE_INTERVIEW_SCHEDULE = 'candidate-schedule-interview',
	INTERVIEWER_INTERVIEW_SCHEDULE = 'interviewer-interview-schedule',
	WELCOME_USER = 'welcome-user',
	EMAIL_VERIFICATION = 'email-verification',
	INVITE_ORGANIZATION_CLIENT = 'invite-organization-client',
	INVITE_EMPLOYEE = 'invite-employee',
	INVITE_GAUZY_TEAMS = 'invite-gauzy-teams',
	INVITE_USER = 'invite-user',
	EMAIL_INVOICE = 'email-invoice',
	EMAIL_ESTIMATE = 'email-estimate',
	EMPLOYEE_JOIN = 'employee-join',
	EMAIL_RESET = 'email-reset',
	ORGANIZATION_TEAM_JOIN_REQUEST = 'organization-team-join-request',
	PAYMENT_RECEIPT = 'payment-receipt',
	REJECT_CANDIDATE = 'reject-candidate'
}

export interface ICustomizeEmailTemplateFindInput extends IBasePerTenantAndOrganizationEntityModel {
	name: EmailTemplateEnum;
	languageCode: LanguagesEnum;
}

export interface ICustomizableEmailTemplate {
	template: string;
	subject: string;
}

export interface IEmailTemplateSaveInput extends ICustomizeEmailTemplateFindInput {
	mjml: string;
	subject: string;
}
