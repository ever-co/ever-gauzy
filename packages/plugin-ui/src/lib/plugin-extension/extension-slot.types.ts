import { Type } from '@angular/core';

/**
 * Well-known extension slot identifiers.
 * Host components render extensions registered for these slots.
 *
 * Use EXTENSION_SLOTS for consistency, or define custom slot ids for plugin-specific areas.
 */
export const EXTENSION_SLOTS = {
	// ─── Page-level widgets ─────────────────────────────────────
	/** Dashboard page widgets/cards. */
	DASHBOARD_WIDGETS: 'dashboard-widgets',

	/** Settings page tabs (use with PageTabRegistryService tabsetIds). */
	SETTINGS_TABS: 'settings-tabs',

	/** Integrations list items (e.g. integration tiles). */
	INTEGRATIONS_LIST: 'integrations-list',

	/** Top-level page sections (alternative to page-sections routes). */
	PAGE_SECTIONS: 'page-sections',

	// ─── Layout / shell ─────────────────────────────────────────
	/** User menu dropdown items. */
	USER_MENU_ITEMS: 'user-menu-items',

	/** Header toolbar actions. */
	HEADER_TOOLBAR: 'header-toolbar',

	/** Sidebar footer. */
	SIDEBAR_FOOTER: 'sidebar-footer',

	// ─── Tab pages (align with PageTabsetPageId from @gauzy/ui-core) ─
	/** Dashboard tabs (tabset: dashboard-page). */
	DASHBOARD_TABS: 'dashboard-page',

	/** Timesheet tabs (tabset: timesheet-page). */
	TIMESHEET_TABS: 'timesheet-page',

	/** Time & activity tabs (tabset: time-activity-page). */
	TIME_ACTIVITY_TABS: 'time-activity-page',

	/** Employee edit tabs (tabset: employee-edit-page). */
	EMPLOYEE_EDIT_TABS: 'employee-edit-page'
} as const;

/** Tab slot ids that map to PageTabRegistryService tabsetIds. */
export const TAB_EXTENSION_SLOTS = [
	EXTENSION_SLOTS.DASHBOARD_TABS,
	EXTENSION_SLOTS.TIMESHEET_TABS,
	EXTENSION_SLOTS.TIME_ACTIVITY_TABS,
	EXTENSION_SLOTS.EMPLOYEE_EDIT_TABS
] as const;

/** Extension slot identifier. Use EXTENSION_SLOTS or custom strings. */
export type ExtensionSlotId = string;

/**
 * Definition for an extension contributed to a slot.
 */
export interface ExtensionDefinition<T = unknown> {
	/** Unique id for this extension (e.g. 'my-plugin-widget'). */
	id: string;

	/** Slot this extension contributes to. */
	slotId: ExtensionSlotId;

	/** Angular component to render. */
	component?: Type<unknown>;

	/** Optional static config passed to the component. */
	config?: T;

	/** Optional order hint (lower = earlier). */
	order?: number;
}
