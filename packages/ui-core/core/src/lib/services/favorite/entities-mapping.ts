import { BaseEntityEnum } from '@gauzy/contracts';

/**
 * Maps entity types to their corresponding FontAwesome icon classes
 * Used for consistent icon representation across the favorites system
 */
export const ENTITY_ICONS: Record<BaseEntityEnum, string> = {
	[BaseEntityEnum.OrganizationProject]: 'fas fa-book',
	[BaseEntityEnum.Task]: 'fas fa-tasks',
	[BaseEntityEnum.Employee]: 'fas fa-user-friends',
	[BaseEntityEnum.Candidate]: 'fas fa-user-tie',
	[BaseEntityEnum.Contact]: 'fas fa-address-book',
	[BaseEntityEnum.OrganizationTeam]: 'fas fa-users',
	[BaseEntityEnum.OrganizationVendor]: 'fas fa-truck',
	[BaseEntityEnum.OrganizationSprint]: 'fas fa-running',
	[BaseEntityEnum.OrganizationProjectModule]: 'fas fa-puzzle-piece',
	[BaseEntityEnum.TaskView]: 'fas fa-eye',
	[BaseEntityEnum.OrganizationDepartment]: 'fas fa-sitemap',
	[BaseEntityEnum.OrganizationDocument]: 'fas fa-file-alt',
	[BaseEntityEnum.Expense]: 'fas fa-money-bill-wave',
	[BaseEntityEnum.Invoice]: 'fas fa-file-invoice-dollar',
	[BaseEntityEnum.Income]: 'fas fa-coins',
	[BaseEntityEnum.DailyPlan]: 'fas fa-calendar-day',
	[BaseEntityEnum.Dashboard]: 'fas fa-th-large',
	[BaseEntityEnum.DashboardWidget]: 'fas fa-th',
	[BaseEntityEnum.ResourceLink]: 'fas fa-link',
	[BaseEntityEnum.ScreeningTask]: 'fas fa-clipboard-check',
	[BaseEntityEnum.TaskLinkedIssue]: 'fas fa-link',
	[BaseEntityEnum.User]: 'fas fa-user',
	[BaseEntityEnum.Tenant]: 'fas fa-building',
	[BaseEntityEnum.OrganizationContact]: 'fas fa-address-card',
	[BaseEntityEnum.Comment]: 'fas fa-comments',
	[BaseEntityEnum.Currency]: 'fas fa-coins',
	[BaseEntityEnum.Language]: 'fas fa-language',
	[BaseEntityEnum.Organization]: 'fas fa-building'
};

export const ENTITY_LINKS: Record<BaseEntityEnum, (id: string) => string> = {
	[BaseEntityEnum.OrganizationProject]: (id) => `/pages/organization/projects/${id}/edit`,
	[BaseEntityEnum.Task]: (id) => `/pages/tasks/dashboard?taskId=${id}`,
	[BaseEntityEnum.Employee]: (id) => `/pages/employees/edit/${id}/account`,
	[BaseEntityEnum.Candidate]: (id) => `/pages/employees/candidates/edit/${id}`,
	[BaseEntityEnum.Contact]: (id) => `/pages/contacts/view/${id}`,
	[BaseEntityEnum.OrganizationTeam]: () => `/pages/organization/teams`,
	[BaseEntityEnum.OrganizationVendor]: (id) => `/pages/organization/vendors/edit/${id}`,
	[BaseEntityEnum.OrganizationSprint]: (id) => `/pages/organization/sprints/edit/${id}`,
	[BaseEntityEnum.OrganizationProjectModule]: (id) => `/pages/organization/projects/modules/${id}/edit`,
	[BaseEntityEnum.TaskView]: (id) => `/pages/tasks/views/${id}`,
	[BaseEntityEnum.OrganizationDepartment]: (id) => `/pages/organization/departments/edit/${id}`,
	[BaseEntityEnum.OrganizationDocument]: (id) => `/pages/organization/documents/edit/${id}`,
	[BaseEntityEnum.Expense]: (id) => `/pages/accounting/expenses/edit/${id}`,
	[BaseEntityEnum.Invoice]: (id) => `/pages/accounting/invoices/edit/${id}`,
	[BaseEntityEnum.Income]: (id) => `/pages/accounting/income/edit/${id}`,
	[BaseEntityEnum.DailyPlan]: (id) => `/pages/daily-plans/edit/${id}`,
	[BaseEntityEnum.Dashboard]: () => `/pages/dashboard`,
	[BaseEntityEnum.DashboardWidget]: () => `/pages/dashboard`,
	[BaseEntityEnum.ResourceLink]: (id) => `/pages/resource-links/edit/${id}`,
	[BaseEntityEnum.ScreeningTask]: (id) => `/pages/tasks/screening/edit/${id}`,
	[BaseEntityEnum.TaskLinkedIssue]: (id) => `/pages/tasks/linked-issues/edit/${id}`,
	[BaseEntityEnum.User]: (id) => `/pages/users/edit/${id}`,
	[BaseEntityEnum.Tenant]: (id) => `/pages/tenants/edit/${id}`,
	[BaseEntityEnum.OrganizationContact]: (id) => `/pages/contacts/view/${id}`,
	[BaseEntityEnum.Comment]: (id) => `/pages/comments/edit/${id}`,
	[BaseEntityEnum.Currency]: (id) => `/pages/settings/currencies/edit/${id}`,
	[BaseEntityEnum.Language]: (id) => `/pages/settings/languages/edit/${id}`,
	[BaseEntityEnum.Organization]: (id) => `/pages/organization/edit/${id}`
};
