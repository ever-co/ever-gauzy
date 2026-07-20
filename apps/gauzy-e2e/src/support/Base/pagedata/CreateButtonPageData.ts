// The "+ Create" button now opens the Quick Actions dialog (ngx-quick-actions): a grouped
// nb-menu of navigation links, NOT the old in-page "Add X" cards. Labels below match the
// rendered menu-titles (header.component.ts createQuickActionsMenu / QUICK_ACTIONS_MENU i18n).
export const CreateButtonData = {
	// Dialog chrome
	quickActionsTitle: 'Quick Actions',
	// Group headers (QUICK_ACTIONS_GROUP)
	accountingGroup: 'Accounting',
	projectManagementGroup: 'Project Management',
	organizationGroup: 'Organization',
	timeTrackingGroup: 'Time Tracking',
	contactsGroup: 'Contacts',
	jobsGroup: 'Jobs',
	// Quick action menu options (QUICK_ACTIONS_MENU). These replace the legacy short labels
	// (Income/Expense/...) that opened in-page cards; clicking now navigates to a route.
	income: 'Create Income',
	expense: 'Create Expense',
	invoice: 'Create Invoice',
	estimate: 'Create Estimate',
	payment: 'Create Payment',
	timeLog: 'Time Log',
	candidate: 'Create Candidate',
	proposal: 'Create Proposal',
	contract: 'Create Contract',
	team: 'Create Team',
	task: 'Create Task',
	project: 'Create Project',
	employee: 'Add Employee',
	lead: 'Create Lead',
	customer: 'Create Customer',
	client: 'Create Client'
};
