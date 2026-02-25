import { Type } from '@angular/core';

/**
 * Well-known extension slot identifiers.
 * Host components render extensions registered for these slots.
 *
 * Use PAGE_EXTENSION_SLOTS for consistency, or define custom slot ids for plugin-specific areas.
 */
export const PAGE_EXTENSION_SLOTS = {
	// ─── Page-level widgets ─────────────────────────────────────
	/** Dashboard page widgets/cards (small stat cards at top). */
	DASHBOARD_WIDGETS: 'dashboard-widgets',

	/** Dashboard page windows/panels (larger content areas). */
	DASHBOARD_WINDOWS: 'dashboard-windows',

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
	PAGE_EXTENSION_SLOTS.DASHBOARD_TABS,
	PAGE_EXTENSION_SLOTS.TIMESHEET_TABS,
	PAGE_EXTENSION_SLOTS.TIME_ACTIVITY_TABS,
	PAGE_EXTENSION_SLOTS.EMPLOYEE_EDIT_TABS
] as const;

/** Extension slot identifier. Use PAGE_EXTENSION_SLOTS or custom strings. */
export type PageExtensionSlotId = string;

/**
 * Definition for an extension contributed to a slot.
 */
export interface PageExtensionDefinition<T = unknown> {
	/** Unique id for this extension (e.g. 'my-plugin-widget'). */
	id: string;

	/** Slot this extension contributes to. */
	slotId: PageExtensionSlotId;

	/** Angular component to render. */
	component?: Type<unknown>;

	/** Optional static config passed to the component. */
	config?: T;

	/** Optional order hint (lower = earlier). */
	order?: number;
}
