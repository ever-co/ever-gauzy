import { gauzyToggleFeatures } from '@env-api/environment';
import { IFeatureCreateInput } from '@gauzy/models';

const features = gauzyToggleFeatures;

export const DEFAULT_FEATURES: IFeatureCreateInput[] = [
	{
		name: 'Dashboard',
		code: 'FEATURE_DASHBOARD',
		description: 'Go to dashboard',
		image: 'dashboard.png',
		link: 'dashboard/accounting',
		isEnabled: features.FEATURE_DASHBOARD
	},
	{
		name: 'Time Tracking',
		code: 'FEATURE_TIME_TRACKING',
		description: 'Download Desktop App, Create First Timesheet',
		image: 'time-tracking-timesheet.png',
		link: 'employees/timesheets',
		isEnabled: features.FEATURE_TIME_TRACKING
	},
	{
		name: 'Estimate',
		code: 'FEATURE_ESTIMATE',
		description: 'Create First Estimate',
		image: 'estimate.png',
		link: 'accounting/invoices/estimates',
		isEnabled: features.FEATURE_ESTIMATE
	},
	{
		name: 'Estimate Received',
		code: 'FEATURE_ESTIMATE_RECEIVED',
		description: 'Received Estimate',
		image: 'estimate-received.png',
		link: 'accounting/invoices/estimates',
		isEnabled: features.FEATURE_ESTIMATE_RECEIVED
	},
	{
		name: 'Invoice',
		code: 'FEATURE_INVOICE',
		description: 'Create First Invoice',
		image: 'invoice.png',
		link: 'accounting/invoices',
		isEnabled: features.FEATURE_INVOICE
	},
	{
		name: 'Invoice Received',
		code: 'FEATURE_INVOICE_RECEIVED',
		description: 'Received Invoice',
		image: 'invoice-received.png',
		link: 'accounting/invoices/received-invoices',
		isEnabled: features.FEATURE_INVOICE_RECEIVED
	},
	{
		name: 'Income',
		code: 'FEATURE_INCOME',
		description: 'Create First Income',
		image: 'income.png',
		link: 'accounting/income',
		isEnabled: features.FEATURE_INCOME
	},
	{
		name: 'Expense',
		code: 'FEATURE_EXPENSE',
		description: 'Create First Expense',
		image: 'expense.png',
		link: 'accounting/expenses',
		isEnabled: features.FEATURE_EXPENSE
	},
	{
		name: 'Payment',
		code: 'FEATURE_PAYMENT',
		description: 'Create First Payment',
		image: 'payment.png',
		link: 'accounting/payments',
		isEnabled: features.FEATURE_PAYMENT
	},
	{
		name: 'Proposal',
		code: 'FEATURE_PROPOSAL',
		description: 'Create First Proposal',
		image: 'proposal.png',
		link: 'sales/proposals',
		isEnabled: features.FEATURE_PROPOSAL
	},
	{
		name: 'Proposal Template',
		code: 'FEATURE_PROPOSAL_TEMPLATE',
		description: 'Create First Proposal Template',
		image: 'proposal-template.png',
		link: 'jobs/proposal-template',
		isEnabled: features.FEATURE_PROPOSAL_TEMPLATE
	},
	{
		name: 'Sales Pipeline',
		code: 'FEATURE_PIPELINE',
		description: 'Create Sales Pipeline',
		image: 'pipeline.png',
		link: 'sales/pipelines',
		isEnabled: features.FEATURE_PIPELINE
	},
	{
		name: 'Sales Pipeline Deal',
		code: 'FEATURE_PIPELINE_DEAL',
		description: 'Create Sales Pipeline Deal',
		image: 'pipeline-deal.png',
		link: 'sales/pipelines',
		isEnabled: features.FEATURE_PIPELINE_DEAL
	},
	{
		name: 'Task Dashboard',
		code: 'FEATURE_DASHBOARD_TASK',
		description: 'Task Dashboard',
		image: 'task-dashboard.png',
		link: 'tasks/dashboard',
		isEnabled: features.FEATURE_DASHBOARD_TASK
	},
	{
		name: 'Team Task Dashboard',
		code: 'FEATURE_TEAM_TASK',
		description: 'Team Task Dashboard',
		image: 'team-task.png',
		link: 'tasks/team',
		isEnabled: features.FEATURE_TEAM_TASK
	},
	{
		name: 'My Task Dashboard',
		code: 'FEATURE_MY_TASK',
		description: 'My Task Dashboard',
		image: 'team-task.png',
		link: 'tasks/me',
		isEnabled: features.FEATURE_MY_TASK
	},
	{
		name: 'Jobs',
		code: 'FEATURE_JOB',
		description: 'Job Search & Jobs Matching',
		image: 'job.png',
		link: 'jobs/search',
		isEnabled: features.FEATURE_JOB
	},
	{
		name: 'Employees',
		code: 'FEATURE_EMPLOYEES',
		description: 'Manage Employees',
		image: 'employee.png',
		link: 'employees',
		isEnabled: features.FEATURE_EMPLOYEES
	},
	{
		name: 'Employee Time Activity',
		code: 'FEATURE_EMPLOYEE_TIME_ACTIVITY',
		description: 'Manage Employee Time Activity',
		image: 'screenshot.png',
		link: 'employees/activity/screenshots',
		isEnabled: features.FEATURE_EMPLOYEE_TIME_ACTIVITY
	},
	{
		name: 'Employee Timesheet',
		code: 'FEATURE_EMPLOYEE_TIMESHEETS',
		description:
			'Manage Employee Timesheet Daily, Weekly, Calendar, Create First Timesheet',
		image: 'timesheet.png',
		link: 'employees/timesheets/daily',
		isEnabled: features.FEATURE_EMPLOYEE_TIMESHEETS
	},
	{
		name: 'Appointment & Schedule',
		code: 'FEATURE_EMPLOYEE_APPOINTMENT',
		description: 'Employee Appointment & Schedule Management',
		image: 'appointment.png',
		link: 'employees/appointments',
		isEnabled: features.FEATURE_EMPLOYEE_APPOINTMENT
	},
	{
		name: 'Employee Approval',
		code: 'FEATURE_EMPLOYEE_APPROVAL',
		description: 'Employee Approval Request',
		image: 'approval.png',
		link: 'employees/approvals',
		isEnabled: features.FEATURE_EMPLOYEE_APPROVAL
	},
	{
		name: 'Employee Approval Policy',
		code: 'FEATURE_EMPLOYEE_APPROVAL_POLICY',
		description: 'Manage Employee Approval Policy',
		image: 'approval-policy.png',
		link: 'organization/approval-policy',
		isEnabled: features.FEATURE_EMPLOYEE_APPROVAL_POLICY
	},
	{
		name: 'Employee Level',
		code: 'FEATURE_EMPLOYEE_LEVEL',
		description: 'Manage Employee Level',
		image: 'employee-level.png',
		link: 'employees/employee-level',
		isEnabled: features.FEATURE_EMPLOYEE_LEVEL
	},
	{
		name: 'Position',
		code: 'FEATURE_EMPLOYEE_POSITION',
		description: 'Manage Employee Position',
		image: 'position.png',
		link: 'employees/positions',
		isEnabled: features.FEATURE_EMPLOYEE_POSITION
	},
	{
		name: 'Employee Time Off',
		code: 'FEATURE_EMPLOYEE_TIMEOFF',
		description: 'Manage Employee Time Off',
		image: 'timeoff.png',
		link: 'employees/time-off',
		isEnabled: features.FEATURE_EMPLOYEE_TIMEOFF
	},
	{
		name: 'Employee Recurring Expense',
		code: 'FEATURE_EMPLOYEE_RECURRING_EXPENSE',
		description: 'Manage Employee Recurring Expense',
		image: 'recurring-expense.png',
		link: 'employees/recurring-expenses',
		isEnabled: features.FEATURE_EMPLOYEE_RECURRING_EXPENSE
	},
	{
		name: 'Candidate',
		code: 'FEATURE_EMPLOYEE_CANDIDATE',
		description: 'Manage Employee Candidate',
		image: 'candidate.png',
		link: 'employees/candidates',
		isEnabled: features.FEATURE_EMPLOYEE_CANDIDATE
	},

	{
		name: 'My Task Dashboard',
		code: 'FEATURE_MANAGE_INTERVIEW',
		description: 'My Task Dashboard',
		image: 'team-task.png',
		link: 'tasks/me',
		isEnabled: features.FEATURE_MANAGE_INTERVIEW
	},
	{
		name: 'My Task Dashboard',
		code: 'FEATURE_MANAGE_INVITE',
		description: 'My Task Dashboard',
		image: 'team-task.png',
		link: 'tasks/me',
		isEnabled: features.FEATURE_MANAGE_INVITE
	},
	{
		name: 'My Task Dashboard',
		code: 'FEATURE_ORGANIZATION',
		description: 'My Task Dashboard',
		image: 'team-task.png',
		link: 'tasks/me',
		isEnabled: features.FEATURE_ORGANIZATION
	},
	{
		name: 'My Task Dashboard',
		code: 'FEATURE_ORGANIZATION_EQUIPMENT',
		description: 'My Task Dashboard',
		image: 'team-task.png',
		link: 'tasks/me',
		isEnabled: features.FEATURE_ORGANIZATION_EQUIPMENT
	},
	{
		name: 'My Task Dashboard',
		code: 'FEATURE_ORGANIZATION_INVENTORY',
		description: 'My Task Dashboard',
		image: 'team-task.png',
		link: 'tasks/me',
		isEnabled: features.FEATURE_ORGANIZATION_INVENTORY
	},
	{
		name: 'My Task Dashboard',
		code: 'FEATURE_ORGANIZATION_TAG',
		description: 'My Task Dashboard',
		image: 'team-task.png',
		link: 'tasks/me',
		isEnabled: features.FEATURE_ORGANIZATION_TAG
	},
	{
		name: 'My Task Dashboard',
		code: 'FEATURE_ORGANIZATION_VENDOR',
		description: 'My Task Dashboard',
		image: 'team-task.png',
		link: 'tasks/me',
		isEnabled: features.FEATURE_ORGANIZATION_VENDOR
	},
	{
		name: 'My Task Dashboard',
		code: 'FEATURE_ORGANIZATION_PROJECT',
		description: 'My Task Dashboard',
		image: 'team-task.png',
		link: 'tasks/me',
		isEnabled: features.FEATURE_ORGANIZATION_PROJECT
	},
	{
		name: 'My Task Dashboard',
		code: 'FEATURE_ORGANIZATION_DEPARTMENT',
		description: 'My Task Dashboard',
		image: 'team-task.png',
		link: 'tasks/me',
		isEnabled: features.FEATURE_ORGANIZATION_DEPARTMENT
	},
	{
		name: 'My Task Dashboard',
		code: 'FEATURE_ORGANIZATION_TEAM',
		description: 'My Task Dashboard',
		image: 'team-task.png',
		link: 'tasks/me',
		isEnabled: features.FEATURE_ORGANIZATION_TEAM
	},
	{
		name: 'My Task Dashboard',
		code: 'FEATURE_ORGANIZATION_DOCUMENT',
		description: 'My Task Dashboard',
		image: 'team-task.png',
		link: 'tasks/me',
		isEnabled: features.FEATURE_ORGANIZATION_DOCUMENT
	},
	{
		name: 'My Task Dashboard',
		code: 'FEATURE_ORGANIZATION_EMPLOYMENT_TYPE',
		description: 'My Task Dashboard',
		image: 'team-task.png',
		link: 'tasks/me',
		isEnabled: features.FEATURE_ORGANIZATION_EMPLOYMENT_TYPE
	},
	{
		name: 'My Task Dashboard',
		code: 'FEATURE_ORGANIZATION_RECURRING_EXPENSE',
		description: 'My Task Dashboard',
		image: 'team-task.png',
		link: 'tasks/me',
		isEnabled: features.FEATURE_ORGANIZATION_RECURRING_EXPENSE
	},
	{
		name: 'My Task Dashboard',
		code: 'FEATURE_ORGANIZATION_HELP_CENTER',
		description: 'My Task Dashboard',
		image: 'team-task.png',
		link: 'tasks/me',
		isEnabled: features.FEATURE_ORGANIZATION_HELP_CENTER
	},
	{
		name: 'My Task Dashboard',
		code: 'FEATURE_CONTACT',
		description: 'My Task Dashboard',
		image: 'team-task.png',
		link: 'tasks/me',
		isEnabled: features.FEATURE_CONTACT
	},
	{
		name: 'My Task Dashboard',
		code: 'FEATURE_GOAL',
		description: 'My Task Dashboard',
		image: 'team-task.png',
		link: 'tasks/me',
		isEnabled: features.FEATURE_GOAL
	},
	{
		name: 'My Task Dashboard',
		code: 'FEATURE_GOAL_REPORT',
		description: 'My Task Dashboard',
		image: 'team-task.png',
		link: 'tasks/me',
		isEnabled: features.FEATURE_GOAL_REPORT
	},
	{
		name: 'My Task Dashboard',
		code: 'FEATURE_GOAL_SETTING',
		description: 'My Task Dashboard',
		image: 'team-task.png',
		link: 'tasks/me',
		isEnabled: features.FEATURE_GOAL_SETTING
	},
	{
		name: 'My Task Dashboard',
		code: 'FEATURE_REPORT',
		description: 'My Task Dashboard',
		image: 'team-task.png',
		link: 'tasks/me',
		isEnabled: features.FEATURE_REPORT
	},
	{
		name: 'My Task Dashboard',
		code: 'FEATURE_USER',
		description: 'My Task Dashboard',
		image: 'team-task.png',
		link: 'tasks/me',
		isEnabled: features.FEATURE_USER
	},
	{
		name: 'My Task Dashboard',
		code: 'FEATURE_ORGANIZATIONS',
		description: 'My Task Dashboard',
		image: 'team-task.png',
		link: 'tasks/me',
		isEnabled: features.FEATURE_ORGANIZATIONS
	},
	{
		name: 'My Task Dashboard',
		code: 'FEATURE_APP_INTEGRATION',
		description: 'My Task Dashboard',
		image: 'team-task.png',
		link: 'tasks/me',
		isEnabled: features.FEATURE_APP_INTEGRATION
	},
	{
		name: 'Email History',
		code: 'FEATURE_EMAIL_HISTORY',
		description: 'Manage Email History',
		image: 'email-history.png',
		link: 'settings/email-history',
		isEnabled: features.FEATURE_EMAIL_HISTORY
	},
	{
		name: 'Custom Email Template',
		code: 'FEATURE_EMAIL_TEMPLATE',
		description: 'Customize Email Template',
		image: 'email-template.png',
		link: 'settings/email-templates',
		isEnabled: features.FEATURE_EMAIL_TEMPLATE
	},
	{
		name: 'Entity Import',
		code: 'FEATURE_IMPORT',
		description: 'Manage Entity Import',
		image: 'import.png',
		link: 'settings/import-export/import',
		isEnabled: features.FEATURE_IMPORT
	},
	{
		name: 'Entity Export',
		code: 'FEATURE_EXPORT',
		description: 'Manage Entity Export',
		image: 'export.png',
		link: 'settings/import-export/export',
		isEnabled: features.FEATURE_EXPORT
	},

	{
		name: 'File Storage',
		code: 'FEATURE_FILE_STORAGE',
		description: 'Manage File Storage Provider',
		image: 'file-storage.png',
		link: 'settings/file-storage',
		isEnabled: features.FEATURE_FILE_STORAGE
	},
	{
		name: 'SMS Gateway',
		code: 'FEATURE_SMS_GATEWAY',
		description: 'Manage SMS Gateway',
		image: 'sms-gateway.png',
		link: 'tasks/me',
		isEnabled: features.FEATURE_SMS_GATEWAY
	},
	{
		name: 'Custom SMTP',
		code: 'FEATURE_SMTP',
		description: 'Manage Tenant & Organization Custom SMTP',

		image: 'smtp.png',
		link: 'settings/custom-smtp',
		isEnabled: features.FEATURE_SMTP
	},
	{
		name: 'Roles & Permissions',
		code: 'FEATURE_ROLES_PERMISSION',
		description: 'Manage Roles & Permissions',
		image: 'role-permission.png',
		link: 'settings/roles',
		isEnabled: features.FEATURE_ROLES_PERMISSION
	}
];
