import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { LanguagesEnum } from './user.model';

export interface IEmailTemplate
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	mjml?: string;
	hbs: string;
	languageCode: string;
}

export interface IEmailTemplateFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	languageCode?: string;
}

export enum EmailTemplateNameEnum {
	PASSWORD_RESET = 'password',
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
	INVITE_ORGANIZATION_CLIENT = 'invite-organization-client',
	INVITE_EMPLOYEE = 'invite-employee',
	INVITE_USER = 'invite-user',
	EMAIL_INVOICE = 'email-invoice',
	EMAIL_ESTIMATE = 'email-estimate'
}

export interface ICustomizeEmailTemplateFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name: EmailTemplateNameEnum;
	languageCode: LanguagesEnum;
	originalUrl?: string;
}

export interface ICustomizableEmailTemplate {
	template: string;
	subject: string;
}

export interface IEmailTemplateSaveInput
	extends ICustomizeEmailTemplateFindInput {
	mjml: string;
	subject: string;
}
