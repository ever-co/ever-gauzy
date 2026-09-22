import { PermissionsEnum } from '@gauzy/contracts';
import { IAgentPageInfo } from '@gauzy/ui-core/core';

/**
 * Curated registry of Gauzy pages the AI agent can open ("canvas" navigation).
 *
 * Every `path` is grounded in the real route tree built by
 * `apps/gauzy/src/app/pages/pages.routes.ts` (plus the per-feature routing
 * modules it lazy-loads and the plugin routes registered at bootstrap, e.g.
 * the Jobs plugins). Titles and permission keys mirror the main navigation
 * menu (`BaseNavMenuComponent` in `@gauzy/ui-core/core`).
 *
 * Only parameterless list/overview pages are listed — routes that require an
 * `:id` segment (edit/view pages) are intentionally omitted.
 */
export const GAUZY_PAGE_REGISTRY: IAgentPageInfo[] = [
	// ── Dashboard & time tracking ────────────────────────────────
	{
		path: '/pages/dashboard',
		title: 'Dashboard',
		description: 'Main dashboard hub; redirects to the time tracking overview by default.'
	},
	{
		path: '/pages/dashboard/time-tracking',
		title: 'Time Tracking Dashboard',
		description: 'Overview of tracked time, activity levels and recent screenshots.'
	},
	// ── Tasks ────────────────────────────────────────────────────
	{
		path: '/pages/tasks/dashboard',
		title: 'Tasks Dashboard',
		description: 'All organization tasks; hosts the task creation and editing forms.',
		permissions: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW]
	},
	{
		path: '/pages/tasks/me',
		title: 'My Tasks',
		description: 'Tasks assigned to the current employee; hosts the task creation form.',
		permissions: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW]
	},
	{
		path: '/pages/tasks/team',
		title: "Team's Tasks",
		description: "Tasks grouped by team; hosts the team task creation form.",
		permissions: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW]
	},

	// ── Projects ─────────────────────────────────────────────────
	{
		path: '/pages/organization/projects',
		title: 'Projects',
		description: 'List and manage organization projects; hosts the project creation form.',
		permissions: [PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_PROJECT_VIEW]
	},

	// ── Employees ────────────────────────────────────────────────
	{
		path: '/pages/employees',
		title: 'Employees',
		description: 'Manage the employee directory; hosts the add-employee and invite forms.',
		permissions: [PermissionsEnum.ORG_EMPLOYEES_VIEW]
	},
	{
		path: '/pages/employees/activity',
		title: 'Time & Activity',
		description: 'Employee screenshots, apps, URLs and activity levels per time slot.',
		permissions: [PermissionsEnum.ADMIN_DASHBOARD_VIEW, PermissionsEnum.TIME_TRACKER]
	},
	{
		path: '/pages/employees/timesheets',
		title: 'Timesheets',
		description: 'Timesheet overview; hosts the manual time entry form.',
		permissions: [PermissionsEnum.ADMIN_DASHBOARD_VIEW, PermissionsEnum.TIME_TRACKER]
	},
	{
		path: '/pages/employees/appointments',
		title: 'Appointments',
		description: 'Employee appointment calendar; hosts the appointment booking form.'
	},
	{
		path: '/pages/employees/approvals',
		title: 'Approvals',
		description: 'Request approvals list; hosts the approval request form.',
		permissions: [PermissionsEnum.REQUEST_APPROVAL_VIEW]
	},
	{
		path: '/pages/employees/time-off',
		title: 'Time Off',
		description: 'Time-off requests and holidays; hosts the time-off request and policy forms.',
		permissions: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.TIME_OFF_VIEW]
	},
	{
		path: '/pages/employees/positions',
		title: 'Positions',
		description: 'Manage employee positions; hosts the position creation form.',
		permissions: [PermissionsEnum.ALL_ORG_VIEW]
	},
	{
		path: '/pages/employees/employee-level',
		title: 'Employee Levels',
		description: 'Manage employee levels; hosts the level creation form.',
		permissions: [PermissionsEnum.ALL_ORG_VIEW]
	},
	{
		path: '/pages/employees/recurring-expenses',
		title: 'Recurring Expenses (Employees)',
		description: 'Per-employee recurring expenses; hosts the recurring expense form.',
		permissions: [PermissionsEnum.EMPLOYEE_EXPENSES_VIEW]
	},
	{
		path: '/pages/employees/invites',
		title: 'Invite People',
		description: 'Manage sent invitations; hosts the email invite form.',
		permissions: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_INVITE_VIEW]
	},

	// ── Candidates (ATS) ─────────────────────────────────────────
	{
		path: '/pages/employees/candidates',
		title: 'Candidates',
		description: 'Manage job candidates and interviews; hosts the add-candidate form.',
		permissions: [PermissionsEnum.ORG_CANDIDATES_VIEW]
	},

	// ── Organization ─────────────────────────────────────────────
	{
		path: '/pages/organization/equipment',
		title: 'Equipment',
		description: 'Organization equipment inventory; hosts the equipment creation form.',
		permissions: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_EQUIPMENT_VIEW]
	},
	{
		path: '/pages/organization/inventory',
		title: 'Inventory',
		description: 'Product inventory gallery; hosts the product creation form.',
		permissions: [PermissionsEnum.ALL_ORG_VIEW]
	},
	{
		path: '/pages/organization/inventory/product-types',
		title: 'Product Types',
		description: 'Manage product types; hosts the product type form.',
		permissions: [PermissionsEnum.ALL_ORG_VIEW]
	},
	{
		path: '/pages/organization/tags',
		title: 'Tags',
		description: 'Manage organization tags; hosts the tag creation form.',
		permissions: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TAGS_ADD]
	},
	{
		path: '/pages/organization/vendors',
		title: 'Vendors',
		description: 'Manage vendors; hosts the vendor creation form.',
		permissions: [PermissionsEnum.ALL_ORG_EDIT]
	},
	{
		path: '/pages/organization/departments',
		title: 'Departments',
		description: 'Manage departments; hosts the department creation form.',
		permissions: [PermissionsEnum.ALL_ORG_EDIT]
	},
	{
		path: '/pages/organization/teams',
		title: 'Teams',
		description: 'Manage organization teams; hosts the team creation form.',
		permissions: [PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TEAM_VIEW]
	},
	{
		path: '/pages/organization/documents',
		title: 'Documents',
		description: 'Organization document storage; hosts the document upload form.',
		permissions: [PermissionsEnum.ALL_ORG_EDIT]
	},
	{
		path: '/pages/organization/employment-types',
		title: 'Employment Types',
		description: 'Manage employment types; hosts the employment type form.',
		permissions: [PermissionsEnum.ALL_ORG_EDIT]
	},
	{
		path: '/pages/organization/expense-recurring',
		title: 'Expense Recurring (Organization)',
		description: 'Organization-level recurring expenses; hosts the recurring expense form.',
		permissions: [PermissionsEnum.ORG_EXPENSES_VIEW]
	},
	{
		path: '/pages/organizations',
		title: 'Organizations',
		description: 'List of tenant organizations; hosts the add-organization wizard.',
		permissions: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_EXPENSES_EDIT]
	},

	// ── Contacts ─────────────────────────────────────────────────
	{
		path: '/pages/contacts/visitors',
		title: 'Visitors',
		description: 'List of website visitors captured as contacts.',
		permissions: [PermissionsEnum.ORG_CONTACT_VIEW, PermissionsEnum.ALL_ORG_VIEW]
	},
	{
		path: '/pages/contacts/leads',
		title: 'Leads',
		description: 'Manage leads; hosts the lead creation form.',
		permissions: [PermissionsEnum.ORG_CONTACT_VIEW, PermissionsEnum.ALL_ORG_VIEW]
	},
	{
		path: '/pages/contacts/customers',
		title: 'Customers',
		description: 'Manage customers; hosts the customer creation form.',
		permissions: [PermissionsEnum.ORG_CONTACT_VIEW, PermissionsEnum.ALL_ORG_VIEW]
	},
	{
		path: '/pages/contacts/clients',
		title: 'Clients',
		description: 'Manage clients; hosts the client creation form.',
		permissions: [PermissionsEnum.ORG_CONTACT_VIEW, PermissionsEnum.ALL_ORG_VIEW]
	},

	// ── Sales ────────────────────────────────────────────────────
	{
		path: '/pages/sales/invoices',
		title: 'Invoices',
		description: 'Sales invoices list; the add form lives at /pages/sales/invoices/add.',
		permissions: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.INVOICES_VIEW]
	},
	{
		path: '/pages/sales/invoices/estimates',
		title: 'Estimates',
		description: 'Sales estimates list; the add form lives at /pages/sales/invoices/estimates/add.',
		permissions: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ESTIMATES_VIEW]
	},
	{
		path: '/pages/sales/invoices/recurring',
		title: 'Invoices Recurring',
		description: 'Recurring sales invoices list.',
		permissions: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.INVOICES_VIEW]
	},
	{
		path: '/pages/sales/payments',
		title: 'Payments',
		description: 'Sales payments list; hosts the record-payment form.',
		permissions: [PermissionsEnum.ORG_PAYMENT_VIEW]
	},
	{
		path: '/pages/sales/pipelines',
		title: 'Pipelines',
		description: 'Sales pipelines and deal stages; hosts the pipeline creation form.',
		permissions: [PermissionsEnum.VIEW_SALES_PIPELINES]
	},
	{
		path: '/pages/sales/proposals',
		title: 'Proposals',
		description: 'Job proposals list; the register form lives at /pages/sales/proposals/register.',
		permissions: [PermissionsEnum.ORG_PROPOSALS_VIEW]
	},

	// ── Accounting ───────────────────────────────────────────────
	{
		path: '/pages/accounting/invoices',
		title: 'Invoices (Accounting)',
		description: 'Accounting view of invoices; the add form lives at /pages/accounting/invoices/add.',
		permissions: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.INVOICES_VIEW]
	},
	{
		path: '/pages/accounting/invoices/received-invoices',
		title: 'Invoices Received',
		description: 'Invoices received from other organizations.',
		permissions: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.INVOICES_VIEW]
	},
	{
		path: '/pages/accounting/income',
		title: 'Income',
		description: 'Income records; hosts the add-income form.',
		permissions: [PermissionsEnum.ORG_INCOMES_VIEW]
	},
	{
		path: '/pages/accounting/expenses',
		title: 'Expenses',
		description: 'Expense records; hosts the add-expense form.',
		permissions: [PermissionsEnum.ORG_EXPENSES_VIEW]
	},
	{
		path: '/pages/accounting/expense-recurring',
		title: 'Expense Recurring',
		description: 'Recurring expenses; hosts the recurring expense form.',
		permissions: [PermissionsEnum.ORG_EXPENSES_VIEW]
	},
	{
		path: '/pages/accounting/payments',
		title: 'Payments (Accounting)',
		description: 'Accounting view of payments; hosts the record-payment form.',
		permissions: [PermissionsEnum.ORG_PAYMENT_VIEW]
	},

	// ── Jobs ─────────────────────────────────────────────────────
	{
		path: '/pages/jobs/employee',
		title: 'Jobs Employees',
		description: 'Per-employee job search settings and statistics.',
		permissions: [PermissionsEnum.ORG_JOB_EMPLOYEE_VIEW]
	},
	{
		path: '/pages/jobs/search',
		title: 'Jobs Search',
		description: 'Browse and apply to matched job postings.',
		permissions: [PermissionsEnum.ORG_JOB_SEARCH]
	},
	{
		path: '/pages/jobs/matching',
		title: 'Jobs Matching',
		description: 'Configure job matching criteria and presets per employee.',
		permissions: [PermissionsEnum.ORG_JOB_MATCHING_VIEW]
	},
	{
		path: '/pages/jobs/proposal-template',
		title: 'Proposal Templates',
		description: 'Manage job proposal templates; hosts the template editor form.',
		permissions: [PermissionsEnum.ORG_PROPOSAL_TEMPLATES_VIEW]
	},

	// ── Goals ────────────────────────────────────────────────────
	{
		path: '/pages/goals',
		title: 'Goals',
		description: 'Goals and key results (OKR); hosts the goal and key result forms.'
	},
	{
		path: '/pages/goals/settings',
		title: 'Goal Settings',
		description: 'Configure goal time frames and KPIs.'
	},

	// ── Reports ──────────────────────────────────────────────────
	{
		path: '/pages/reports/all',
		title: 'All Reports',
		description: 'Directory of all available reports.'
	},
	{
		path: '/pages/reports/time-activity',
		title: 'Time & Activity Report',
		description: 'Report of tracked time and activity percentages.'
	},
	{
		path: '/pages/reports/weekly',
		title: 'Weekly Report',
		description: 'Weekly summary of tracked time per employee.'
	},
	{
		path: '/pages/reports/apps-urls',
		title: 'Apps & URLs Report',
		description: 'Report of applications used and websites visited.'
	},
	{
		path: '/pages/reports/manual-time-edits',
		title: 'Manual Time Edits Report',
		description: 'Report of manually added or edited time entries.'
	},
	{
		path: '/pages/reports/expense',
		title: 'Expense Report',
		description: 'Report of recorded expenses over time.'
	},
	{
		path: '/pages/reports/payments',
		title: 'Payments Report',
		description: 'Report of received payments.'
	},
	{
		path: '/pages/reports/amounts-owed',
		title: 'Amounts Owed Report',
		description: 'Report of outstanding amounts owed to employees.'
	},
	{
		path: '/pages/reports/weekly-limits',
		title: 'Weekly Limits Report',
		description: 'Report of employees against their weekly time limits.'
	},
	{
		path: '/pages/reports/project-budgets',
		title: 'Project Budgets Report',
		description: 'Report of spending against project budgets.'
	},
	{
		path: '/pages/reports/client-budgets',
		title: 'Client Budgets Report',
		description: 'Report of spending against client budgets.'
	},

	// ── Users & access control ───────────────────────────────────
	{
		path: '/pages/users',
		title: 'Users',
		description: 'Manage workspace users; hosts the add-user and invite forms.',
		permissions: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_USERS_VIEW]
	},
	{
		path: '/pages/settings/roles-permissions',
		title: 'Roles & Permissions',
		description: 'Configure role-based permissions per role.',
		permissions: [PermissionsEnum.CHANGE_ROLES_PERMISSIONS]
	},

	// ── Settings ─────────────────────────────────────────────────
	{
		path: '/pages/settings/general',
		title: 'General Settings',
		description: 'General user and appearance settings form.'
	},
	{
		path: '/pages/settings/features',
		title: 'Features',
		description: 'Enable or disable platform features per tenant/organization.',
		permissions: [PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ALL_ORG_VIEW]
	},
	{
		path: '/pages/settings/email-history',
		title: 'Email History',
		description: 'History of emails sent by the platform.',
		permissions: [PermissionsEnum.VIEW_ALL_EMAILS]
	},
	{
		path: '/pages/settings/email-templates',
		title: 'Email Templates',
		description: 'Customize outgoing email templates; hosts the template editor.',
		permissions: [PermissionsEnum.VIEW_ALL_EMAIL_TEMPLATES]
	},
	{
		path: '/pages/settings/file-storage',
		title: 'File Storage',
		description: 'Configure the file storage provider (local, S3, etc.).',
		permissions: [PermissionsEnum.FILE_STORAGE_VIEW]
	},

	// ── Integrations & data ──────────────────────────────────────
	{
		path: '/pages/integrations',
		title: 'Integrations',
		description: 'Browse and configure third-party integrations (GitHub, Upwork, Hubstaff, etc.).',
		permissions: [PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT]
	},
	{
		path: '/pages/settings/import-export',
		title: 'Import/Export',
		description: 'Import or export organization data as archives.',
		permissions: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.IMPORT_ADD, PermissionsEnum.EXPORT_ADD]
	}
];
