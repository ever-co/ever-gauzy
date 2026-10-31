/**
 * The built-in Quick Actions: what the Quick Actions dialog (`ngx-quick-actions`) can show and the
 * keyboard shortcut each one has out of the box.
 *
 * The header (`HeaderComponent`) decides which of them the signed-in user may see (permissions,
 * feature flags) and where each one leads; this file only gives every action a STABLE id, its group,
 * its label and its default shortcut, so the dialog, the header and a user's saved customization
 * (`IUserUiPreferences.quickActions`) all speak about the same thing. The id is the menu item's
 * `data.action`.
 */

/** The groups the dialog shows, in their default order (the dialog then sorts them by size). */
export enum QuickActionGroupEnum {
	ACCOUNTING = 'accounting',
	TIME_TRACKING = 'time_tracking',
	JOBS = 'jobs',
	PROJECT_MANAGEMENT = 'pm',
	CONTACTS = 'contacts',
	ORGANIZATION = 'organization',
	DOCUMENTS = 'documents'
}

/** i18n key of each group's title. */
export const QUICK_ACTION_GROUP_TITLES: Readonly<Record<QuickActionGroupEnum, string>> = {
	[QuickActionGroupEnum.ACCOUNTING]: 'QUICK_ACTIONS_GROUP.ACCOUNTING',
	[QuickActionGroupEnum.TIME_TRACKING]: 'QUICK_ACTIONS_GROUP.TIME_TRACKING',
	[QuickActionGroupEnum.JOBS]: 'QUICK_ACTIONS_GROUP.JOBS',
	[QuickActionGroupEnum.PROJECT_MANAGEMENT]: 'QUICK_ACTIONS_GROUP.PROJECT_MANAGEMENT',
	[QuickActionGroupEnum.CONTACTS]: 'QUICK_ACTIONS_GROUP.CONTACTS',
	[QuickActionGroupEnum.ORGANIZATION]: 'QUICK_ACTIONS_GROUP.ORGANIZATION',
	[QuickActionGroupEnum.DOCUMENTS]: 'QUICK_ACTIONS_GROUP.DOCUMENTS'
};

/** One built-in quick action. */
export interface IQuickActionDefinition {
	/** Stable id, persisted in user preferences: never rename one, add a new action instead. */
	readonly id: string;
	readonly group: QuickActionGroupEnum;
	/** i18n key of the label. */
	readonly title: string;
	/** Default shortcut (hotkeys-js syntax); none when absent. */
	readonly shortcut?: string;
}

/** Shortcut that opens and closes the Quick Actions dialog. Not customizable. */
export const QUICK_ACTIONS_DIALOG_SHORTCUT = 'ctrl+Q';

/** Ids of the two actions that drive the timer instead of navigating. */
export const START_TIMER_QUICK_ACTION = 'startTimer';
export const STOP_TIMER_QUICK_ACTION = 'stopTimer';

const { ACCOUNTING, ORGANIZATION, PROJECT_MANAGEMENT, JOBS, CONTACTS, TIME_TRACKING, DOCUMENTS } = QuickActionGroupEnum;

/** One row of the table below; `label` is the key under `QUICK_ACTIONS_MENU`. */
const define = (id: string, group: QuickActionGroupEnum, label: string, shortcut?: string): IQuickActionDefinition => ({
	id,
	group,
	title: `QUICK_ACTIONS_MENU.${label}`,
	shortcut
});

/**
 * Every built-in quick action in its default order (the order the header builds its menu in).
 * The shortcuts are the ones the header has always registered.
 */
export const QUICK_ACTION_DEFINITIONS: ReadonlyArray<IQuickActionDefinition> = [
	// Accounting
	define('createInvoice', ACCOUNTING, 'CREATE_INVOICE', 'I'),
	define('receivedInvoices', ACCOUNTING, 'RECEIVED_INVOICES', 'shift+I'),
	define('createIncome', ACCOUNTING, 'CREATE_INCOME', 'C'),
	define('createExpense', ACCOUNTING, 'CREATE_EXPENSE', 'X'),
	define('createEstimate', ACCOUNTING, 'CREATE_ESTIMATE', 'E'),
	define('receivedEstimates', ACCOUNTING, 'RECEIVED_ESTIMATES', 'shift+E'),
	define('createPayment', ACCOUNTING, 'CREATE_PAYMENT', 'P'),
	// Organization
	define('addEmployee', ORGANIZATION, 'ADD_EMPLOYEE', 'A+E'),
	define('addInventory', ORGANIZATION, 'ADD_INVENTORY', 'A+I'),
	define('addEquipment', ORGANIZATION, 'ADD_EQUIPMENT', 'A+Q'),
	define('addVendor', ORGANIZATION, 'ADD_VENDOR', 'A+V'),
	define('addDepartment', ORGANIZATION, 'ADD_DEPARTMENT', 'A+D'),
	// Project management
	define('createTeam', PROJECT_MANAGEMENT, 'CREATE_TEAM', 'G'),
	define('createTask', PROJECT_MANAGEMENT, 'CREATE_TASK', 'T'),
	define('createProject', PROJECT_MANAGEMENT, 'CREATE_PROJECT', 'J'),
	define('viewTasks', PROJECT_MANAGEMENT, 'VIEW_TASKS', 'shift+T'),
	define('viewTeamTasks', PROJECT_MANAGEMENT, 'VIEW_TEAM_TASKS', 'shift+G'),
	// Jobs
	define('createCandidate', JOBS, 'CREATE_CANDIDATE', 'U'),
	define('createProposal', JOBS, 'CREATE_PROPOSAL', 'R'),
	define('createContract', JOBS, 'CREATE_CONTRACT', 'K'),
	// Contacts
	define('createLead', CONTACTS, 'CREATE_LEAD', 'D'),
	define('createCustomer', CONTACTS, 'CREATE_CUSTOMER', 'M'),
	define('createClient', CONTACTS, 'CREATE_CLIENT', 'N'),
	define('viewClients', CONTACTS, 'VIEW_CLIENTS', 'shift+N'),
	// Time tracking
	define('timeLog', TIME_TRACKING, 'TIME_LOG', 'shift+L'),
	define('viewAppointments', TIME_TRACKING, 'VIEW_APPOINTMENTS', 'shift+A'),
	define('viewTimeActivity', TIME_TRACKING, 'VIEW_TIME_ACTIVITY', 'shift+S'),
	define(START_TIMER_QUICK_ACTION, TIME_TRACKING, 'START_TIMER', 'S'),
	define(STOP_TIMER_QUICK_ACTION, TIME_TRACKING, 'STOP_TIMER', 'O'),
	// Documents (`@gauzy/plugin-docs-ui`): no default shortcut
	define('newDocumentPage', DOCUMENTS, 'DOCUMENTS.NEW_PAGE'),
	define('uploadDocuments', DOCUMENTS, 'DOCUMENTS.UPLOAD')
];

/** The quick-action id a menu item carries (`NbMenuItem.data.action`). */
export function getQuickActionId(item: { data?: { action?: unknown } } | null | undefined): string | undefined {
	const action = item?.data?.action;
	return typeof action === 'string' ? action : undefined;
}

/** The definition with this id, if it is a built-in action. */
export function findQuickActionDefinition(
	id: string | null | undefined,
	definitions: ReadonlyArray<IQuickActionDefinition> = QUICK_ACTION_DEFINITIONS
): IQuickActionDefinition | undefined {
	return id ? definitions.find((definition) => definition.id === id) : undefined;
}

/**
 * The default shortcuts keyed by action id (`{ createInvoice: 'I', receivedInvoices: 'shift+I', ... }`),
 * written as the header has always written them. Actions without a default shortcut are left out.
 */
export function getDefaultQuickActionShortcuts(
	definitions: ReadonlyArray<IQuickActionDefinition> = QUICK_ACTION_DEFINITIONS
): Record<string, string> {
	const shortcuts: Record<string, string> = {};
	for (const { id, shortcut } of definitions) {
		if (shortcut) {
			shortcuts[id] = shortcut;
		}
	}
	return shortcuts;
}
