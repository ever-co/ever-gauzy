import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface IFeature extends IBasePerTenantAndOrganizationEntityModel {
	code: FeatureEnum;
	description: string;
	featureOrganizations?: IFeatureOrganization[];
	image: string;
	readonly imageUrl?: string;
	link: string;
	name: string;
	status: string;
	icon: string;
	isEnabled?: boolean;
	isPaid?: boolean;
	readonly parentId?: string;
	parent?: IFeature;
	children?: IFeature[];
}
export interface IFeatureCreateInput extends IFeature {
	isEnabled: boolean;
}

export interface IFeatureOrganization
	extends IBasePerTenantAndOrganizationEntityModel {
	feature: IFeature;
	featureId?: string;
	isEnabled: boolean;
}

export interface IFeatureOrganizationUpdateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	featureId: string;
	isEnabled: boolean;
}

export interface IFeatureOrganizationFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	featureId?: string;
}

export enum FeatureStatusEnum {
	INFO = 'info',
	PRIMARY = 'primary',
	SUCCESS = 'success',
	WARNING = 'warning'
}

export enum IFeatureToggleTypeEnum {
	RELEASE = 'release',
	KILL_SWITCH = 'kill-switch',
	EXPERIMENT = 'experiment',
	OPERATIONAL = 'operational',
	PERMISSION = 'permission'
}

export interface IFeatureToggleVariant {
	name?: string;
	weight?: number;
	weightType?: string;
	payload?: IFeatureTogglePayload;
	overrides?: IFeatureToggleOverride[];
}

export interface IFeatureToggleOverride {
	contextName?: string;
	values?: string[];
}

export interface IFeatureTogglePayload {
	type?: string;
	value?: string;
}

export interface IFeatureToggle {
	name: string;
	description?: string;
	type: IFeatureToggleTypeEnum;
	project?: string;
	enabled: boolean;
	stale?: boolean;
	strategies?: any;
	variants?: IFeatureToggleVariant[];
	createdAt?: string;
	lastSeenAt?: string | null;
}

export enum FeatureEnum {
	FEATURE_DASHBOARD = 'FEATURE_DASHBOARD',
	FEATURE_TIME_TRACKING = 'FEATURE_TIME_TRACKING',
	FEATURE_ESTIMATE = 'FEATURE_ESTIMATE',
	FEATURE_ESTIMATE_RECEIVED = 'FEATURE_ESTIMATE_RECEIVED',
	FEATURE_INVOICE = 'FEATURE_INVOICE',
	FEATURE_INVOICE_RECURRING = 'FEATURE_INVOICE_RECURRING',
	FEATURE_INVOICE_RECEIVED = 'FEATURE_INVOICE_RECEIVED',
	FEATURE_INCOME = 'FEATURE_INCOME',
	FEATURE_EXPENSE = 'FEATURE_EXPENSE',
	FEATURE_PAYMENT = 'FEATURE_PAYMENT',
	FEATURE_PROPOSAL = 'FEATURE_PROPOSAL',
	FEATURE_PROPOSAL_TEMPLATE = 'FEATURE_PROPOSAL_TEMPLATE',
	FEATURE_PIPELINE = 'FEATURE_PIPELINE',
	FEATURE_PIPELINE_DEAL = 'FEATURE_PIPELINE_DEAL',
	FEATURE_DASHBOARD_TASK = 'FEATURE_DASHBOARD_TASK',
	FEATURE_TEAM_TASK = 'FEATURE_TEAM_TASK',
	FEATURE_MY_TASK = 'FEATURE_MY_TASK',
	FEATURE_JOB = 'FEATURE_JOB',
	FEATURE_EMPLOYEES = 'FEATURE_EMPLOYEES',
	FEATURE_EMPLOYEE_TIME_ACTIVITY = 'FEATURE_EMPLOYEE_TIME_ACTIVITY',
	FEATURE_EMPLOYEE_TIMESHEETS = 'FEATURE_EMPLOYEE_TIMESHEETS',
	FEATURE_EMPLOYEE_APPOINTMENT = 'FEATURE_EMPLOYEE_APPOINTMENT',
	FEATURE_EMPLOYEE_APPROVAL = 'FEATURE_EMPLOYEE_APPROVAL',
	FEATURE_EMPLOYEE_APPROVAL_POLICY = 'FEATURE_EMPLOYEE_APPROVAL_POLICY',
	FEATURE_EMPLOYEE_LEVEL = 'FEATURE_EMPLOYEE_LEVEL',
	FEATURE_EMPLOYEE_POSITION = 'FEATURE_EMPLOYEE_POSITION',
	FEATURE_EMPLOYEE_TIMEOFF = 'FEATURE_EMPLOYEE_TIMEOFF',
	FEATURE_EMPLOYEE_RECURRING_EXPENSE = 'FEATURE_EMPLOYEE_RECURRING_EXPENSE',
	FEATURE_EMPLOYEE_CANDIDATE = 'FEATURE_EMPLOYEE_CANDIDATE',
	FEATURE_MANAGE_INTERVIEW = 'FEATURE_MANAGE_INTERVIEW',
	FEATURE_MANAGE_INVITE = 'FEATURE_MANAGE_INVITE',
	FEATURE_ORGANIZATION = 'FEATURE_ORGANIZATION',
	FEATURE_ORGANIZATION_EQUIPMENT = 'FEATURE_ORGANIZATION_EQUIPMENT',
	FEATURE_ORGANIZATION_INVENTORY = 'FEATURE_ORGANIZATION_INVENTORY',
	FEATURE_ORGANIZATION_TAG = 'FEATURE_ORGANIZATION_TAG',
	FEATURE_ORGANIZATION_VENDOR = 'FEATURE_ORGANIZATION_VENDOR',
	FEATURE_ORGANIZATION_PROJECT = 'FEATURE_ORGANIZATION_PROJECT',
	FEATURE_ORGANIZATION_DEPARTMENT = 'FEATURE_ORGANIZATION_DEPARTMENT',
	FEATURE_ORGANIZATION_TEAM = 'FEATURE_ORGANIZATION_TEAM',
	FEATURE_ORGANIZATION_DOCUMENT = 'FEATURE_ORGANIZATION_DOCUMENT',
	FEATURE_ORGANIZATION_EMPLOYMENT_TYPE = 'FEATURE_ORGANIZATION_EMPLOYMENT_TYPE',
	FEATURE_ORGANIZATION_RECURRING_EXPENSE = 'FEATURE_ORGANIZATION_RECURRING_EXPENSE',
	FEATURE_ORGANIZATION_HELP_CENTER = 'FEATURE_ORGANIZATION_HELP_CENTER',
	FEATURE_CONTACT = 'FEATURE_CONTACT',
	FEATURE_GOAL = 'FEATURE_GOAL',
	FEATURE_GOAL_REPORT = 'FEATURE_GOAL_REPORT',
	FEATURE_GOAL_SETTING = 'FEATURE_GOAL_SETTING',
	FEATURE_REPORT = 'FEATURE_REPORT',
	FEATURE_USER = 'FEATURE_USER',
	FEATURE_ORGANIZATIONS = 'FEATURE_ORGANIZATIONS',
	FEATURE_APP_INTEGRATION = 'FEATURE_APP_INTEGRATION',
	FEATURE_SETTING = 'FEATURE_SETTING',
	FEATURE_EMAIL_HISTORY = 'FEATURE_EMAIL_HISTORY',
	FEATURE_EMAIL_TEMPLATE = 'FEATURE_EMAIL_TEMPLATE',
	FEATURE_IMPORT_EXPORT = 'FEATURE_IMPORT_EXPORT',
	FEATURE_FILE_STORAGE = 'FEATURE_FILE_STORAGE',
	FEATURE_PAYMENT_GATEWAY = 'FEATURE_PAYMENT_GATEWAY',
	FEATURE_SMS_GATEWAY = 'FEATURE_SMS_GATEWAY',
	FEATURE_SMTP = 'FEATURE_SMTP',
	FEATURE_ROLES_PERMISSION = 'FEATURE_ROLES_PERMISSION',
	FEATURE_EMAIL_VERIFICATION = 'FEATURE_EMAIL_VERIFICATION',

	/** Defines feature flags and settings related to user authentication methods. */
	FEATURE_EMAIL_PASSWORD_LOGIN = 'FEATURE_EMAIL_PASSWORD_LOGIN',
	FEATURE_MAGIC_LOGIN = 'FEATURE_MAGIC_LOGIN',
	FEATURE_GITHUB_LOGIN = 'FEATURE_GITHUB_LOGIN',
	FEATURE_FACEBOOK_LOGIN = 'FEATURE_FACEBOOK_LOGIN',
	FEATURE_GOOGLE_LOGIN = 'FEATURE_GOOGLE_LOGIN',
	FEATURE_TWITTER_LOGIN = 'FEATURE_TWITTER_LOGIN',
	FEATURE_MICROSOFT_LOGIN = 'FEATURE_MICROSOFT_LOGIN',
	FEATURE_LINKEDIN_LOGIN = 'FEATURE_LINKEDIN_LOGIN'
}

/**
 * Interface representing flag features for authentication.
 */
export interface IAuthenticationFlagFeatures {
	/** Flag indicating whether email/password login is enabled. */
	FEATURE_EMAIL_PASSWORD_LOGIN: boolean;

	/** Flag indicating whether magic login is enabled. */
	FEATURE_MAGIC_LOGIN: boolean;

	/** Flag indicating whether GitHub login is enabled. */
	FEATURE_GITHUB_LOGIN: boolean;

	/** Flag indicating whether Facebook login is enabled. */
	FEATURE_FACEBOOK_LOGIN: boolean;

	/** Flag indicating whether Google login is enabled. */
	FEATURE_GOOGLE_LOGIN: boolean;

	/** Flag indicating whether Twitter login is enabled. */
	FEATURE_TWITTER_LOGIN: boolean;

	/** Flag indicating whether Microsoft login is enabled. */
	FEATURE_MICROSOFT_LOGIN: boolean;

	/** Flag indicating whether LinkedIn login is enabled. */
	FEATURE_LINKEDIN_LOGIN: boolean;
}
