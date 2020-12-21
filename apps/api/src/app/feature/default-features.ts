import { gauzyToggleFeatures } from '@env-api/environment';
import { IFeatureCreateInput } from '@gauzy/models';

const features = gauzyToggleFeatures;

export const DEFAULT_FEATURES: IFeatureCreateInput[] = [
	{
		name: 'Dashboard',
		code: 'FEATURE_DASHBOARD',
		description:
			'Go to dashboard, Manage Employee Statistics, Time Tracking Dashboard',
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
		description: 'Manage Estimate, Create First Estimate',
		image: 'estimate.png',
		link: 'accounting/invoices/estimates',
		isEnabled: features.FEATURE_ESTIMATE
	},
	{
		name: 'Estimate Received',
		code: 'FEATURE_ESTIMATE_RECEIVED',
		description: 'Manage Received Estimate, Accept and Reject Estimate',
		image: 'estimate-received.png',
		link: 'accounting/invoices/estimates',
		isEnabled: features.FEATURE_ESTIMATE_RECEIVED
	},
	{
		name: 'Invoice',
		code: 'FEATURE_INVOICE',
		description: 'Manage Invoice, Create First Invoice',
		image: 'invoice.png',
		link: 'accounting/invoices',
		isEnabled: features.FEATURE_INVOICE
	},
	{
		name: 'Invoice Received',
		code: 'FEATURE_INVOICE_RECEIVED',
		description: 'View Received Invoice',
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
		description: 'Manage Payment, Create First Payment',
		image: 'payment.png',
		link: 'accounting/payments',
		isEnabled: features.FEATURE_PAYMENT
	},
	{
		name: 'Proposal',
		code: 'FEATURE_PROPOSAL',
		description: 'Manage Proposal, Register First Proposal',
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
		description: 'Manage Employees, Add or Invite Employees',
		image: 'employee.png',
		link: 'employees',
		isEnabled: features.FEATURE_EMPLOYEES
	},
	{
		name: 'Employee Time Activity',
		code: 'FEATURE_EMPLOYEE_TIME_ACTIVITY',
		description:
			'Manage Employee Time Activity, Screenshots, App, Visited Sites, Activities',
		image: 'screenshot.png',
		link: 'employees/activity',
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
		description:
			'Employee Appointment, Schedules & Book Public Appointment',
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
		description: 'Manage Employee Approval Request Policy',
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
		description: 'Manage Candidates, Interviews & Invites',
		image: 'candidate.png',
		link: 'employees/candidates',
		isEnabled: features.FEATURE_EMPLOYEE_CANDIDATE
	},
	{
		name: 'Manage Interview',
		code: 'FEATURE_MANAGE_INTERVIEW',
		description: 'Manage Candidate Interviews',
		image: 'interview.png',
		link: 'employees/candidates/interviews/calendar',
		isEnabled: features.FEATURE_MANAGE_INTERVIEW
	},
	{
		name: 'Manage Invite',
		code: 'FEATURE_MANAGE_INVITE',
		description: 'Manage Invites, Create First Candidate Invites',
		image: 'invite.png',
		link: 'employees/candidates/invites',
		isEnabled: features.FEATURE_MANAGE_INVITE
	},
	{
		name: 'Manage Organization',
		code: 'FEATURE_ORGANIZATION',
		description: 'Manage Organization Details, Location and Settings',
		image: 'organization-detail.png',
		link: 'organizations',
		isEnabled: features.FEATURE_ORGANIZATION
	},
	{
		name: 'Organization Equipment',
		code: 'FEATURE_ORGANIZATION_EQUIPMENT',
		description: 'Manage Organization Equipment, Create First Equipment',
		image: 'equipment.png',
		link: 'organization/equipment',
		isEnabled: features.FEATURE_ORGANIZATION_EQUIPMENT
	},
	{
		name: 'Product Inventory',
		code: 'FEATURE_ORGANIZATION_INVENTORY',
		description: 'Manage Product Inventory, Create First Product',
		image: 'inventory.png',
		link: 'organization/inventory/all',
		isEnabled: features.FEATURE_ORGANIZATION_INVENTORY
	},
	{
		name: 'Organization Tag',
		code: 'FEATURE_ORGANIZATION_TAG',
		description: 'Manage Organization Tag, Create First Tag',
		image: 'tag.png',
		link: 'organization/tags',
		isEnabled: features.FEATURE_ORGANIZATION_TAG
	},
	{
		name: 'Organization Vendor',
		code: 'FEATURE_ORGANIZATION_VENDOR',
		description: 'Manage Organization Vendor, Create First Vendor',
		image: 'vendor.png',
		link: 'organization/vendors',
		isEnabled: features.FEATURE_ORGANIZATION_VENDOR
	},
	{
		name: 'Organization Project',
		code: 'FEATURE_ORGANIZATION_PROJECT',
		description: 'Manage Organization Project, Create First Project',
		image: 'project.png',
		link: 'organization/projects',
		isEnabled: features.FEATURE_ORGANIZATION_PROJECT
	},
	{
		name: 'Organization Department',
		code: 'FEATURE_ORGANIZATION_DEPARTMENT',
		description: 'Manage Organization Department, Create First Department',
		image: 'department.png',
		link: 'organization/departments',
		isEnabled: features.FEATURE_ORGANIZATION_DEPARTMENT
	},
	{
		name: 'Organization Team',
		code: 'FEATURE_ORGANIZATION_TEAM',
		description: 'Manage Organization Team, Create First Team',
		image: 'team.png',
		link: 'organization/teams',
		isEnabled: features.FEATURE_ORGANIZATION_TEAM
	},
	{
		name: 'Organization Document',
		code: 'FEATURE_ORGANIZATION_DOCUMENT',
		description: 'Manage Organization Document, Create First Document',
		image: 'document.png',
		link: 'organization/documents',
		isEnabled: features.FEATURE_ORGANIZATION_DOCUMENT
	},
	{
		name: 'Organization Employment Type',
		code: 'FEATURE_ORGANIZATION_EMPLOYMENT_TYPE',
		description: 'Manage Organization Employment Type',
		image: 'employment-type.png',
		link: 'organization/employment-types',
		isEnabled: features.FEATURE_ORGANIZATION_EMPLOYMENT_TYPE
	},
	{
		name: 'Organization Recurring Expenses',
		code: 'FEATURE_ORGANIZATION_RECURRING_EXPENSE',
		description:
			'Manage Organization Recurring Expenses, Create First Recurring Expenses',
		image: 'organization-recurring-expense.png',
		link: 'organization/expense-recurring',
		isEnabled: features.FEATURE_ORGANIZATION_RECURRING_EXPENSE
	},
	{
		name: 'Help Center',
		code: 'FEATURE_ORGANIZATION_HELP_CENTER',
		description: 'Find out more about how to use Gauzy',
		image: 'help.png',
		link: 'help',
		isEnabled: features.FEATURE_ORGANIZATION_HELP_CENTER
	},
	{
		name: 'Lead, Customer & Client',
		code: 'FEATURE_CONTACT',
		description:
			'Manage Leads, Customers and Clients, Create First Customer/Clients',
		image: 'contact.png',
		link: 'contacts/customers',
		isEnabled: features.FEATURE_CONTACT
	},
	{
		name: 'Goal and Objective',
		code: 'FEATURE_GOAL',
		description: 'Manage Goals and Objectives',
		image: 'goal.png',
		link: 'goals',
		isEnabled: features.FEATURE_GOAL
	},
	{
		name: 'Goal Time Frame & KPI',
		code: 'FEATURE_GOAL_SETTING',
		description: 'Manage Goal Time Framework & KPIs',
		image: 'goal-setting.png',
		link: 'goals/settings',
		isEnabled: features.FEATURE_GOAL_SETTING
	},
	{
		name: 'All Report',
		code: 'FEATURE_REPORT',
		description: 'Manage Expense, Weekly, Time & Activity and etc reports',
		image: 'all-report.png',
		link: 'reports/all',
		isEnabled: features.FEATURE_REPORT
	},
	{
		name: 'Tenant User',
		code: 'FEATURE_USER',
		description: 'Manage Tenant Users',
		image: 'user.png',
		link: 'users',
		isEnabled: features.FEATURE_USER
	},
	{
		name: 'Tenant Organization',
		code: 'FEATURE_ORGANIZATIONS',
		description: 'Manage Tenant Organizations',
		image: 'organization.png',
		link: 'organizations',
		isEnabled: features.FEATURE_ORGANIZATIONS
	},
	{
		name: 'Apps & Integrations',
		code: 'FEATURE_APP_INTEGRATION',
		description:
			'Manage Available Apps & Integrations Like Upwork & Hubstaff',
		image: 'app-integration.png',
		link: 'integrations/list',
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
