import { Injector, Type } from '@angular/core';

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

// ─────────────────────────────────────────────────────────────────────────────
// Extension Wrapper Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Built-in wrapper types for extensions.
 * Wrappers provide consistent styling and layout for extensions.
 */
export type ExtensionWrapperType = 'none' | 'card' | 'widget' | 'window' | 'panel';

/**
 * Custom wrapper configuration.
 */
export interface ExtensionWrapperConfig {
	/** Wrapper type or 'custom' for custom component */
	type: ExtensionWrapperType | 'custom';
	/** Custom wrapper component (when type is 'custom') */
	component?: Type<unknown>;
	/** Additional CSS classes for the wrapper */
	cssClass?: string;
	/** Wrapper title (for card/panel wrappers) */
	title?: string;
	/** Show/hide header (for card/panel wrappers) */
	showHeader?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extension Lifecycle Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Context passed to extension lifecycle hooks.
 */
export interface ExtensionLifecycleContext {
	/** Angular injector for accessing services */
	injector: Injector;
	/** The extension definition */
	extension: PageExtensionDefinition;
	/** The slot ID where the extension is rendered */
	slotId: PageExtensionSlotId;
	/** Additional context data from the host */
	data?: Record<string, unknown>;
}

/**
 * Lifecycle hooks for extensions.
 */
export interface ExtensionLifecycleHooks {
	/**
	 * Called when the extension component is mounted/rendered.
	 * Use for initialization, subscriptions, etc.
	 */
	onMount?: (context: ExtensionLifecycleContext) => void | Promise<void>;

	/**
	 * Called when the extension component is unmounted/destroyed.
	 * Use for cleanup, unsubscriptions, etc.
	 */
	onUnmount?: (context: ExtensionLifecycleContext) => void | Promise<void>;

	/**
	 * Called when the extension becomes active (e.g., tab selected).
	 */
	onActivate?: (context: ExtensionLifecycleContext) => void | Promise<void>;

	/**
	 * Called when the extension becomes inactive (e.g., tab deselected).
	 */
	onDeactivate?: (context: ExtensionLifecycleContext) => void | Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extension Visibility Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Context passed to visibility check functions.
 */
export interface ExtensionVisibilityContext {
	/** Angular injector for accessing services */
	injector: Injector;
	/** Current user (if available) */
	user?: unknown;
	/** Current organization (if available) */
	organization?: unknown;
	/** Additional context data */
	data?: Record<string, unknown>;
}

/**
 * Visibility control options for extensions.
 */
export interface ExtensionVisibilityConfig {
	/**
	 * Required permissions to show this extension.
	 * Extension is visible only if user has ALL listed permissions.
	 */
	permissions?: string[];

	/**
	 * Required permission (any one).
	 * Extension is visible if user has ANY of the listed permissions.
	 */
	permissionsAny?: string[];

	/**
	 * Feature flag key.
	 * Extension is visible only if the feature is enabled.
	 */
	featureKey?: string;

	/**
	 * Custom visibility function.
	 * Return true to show, false to hide.
	 */
	visible?: (context: ExtensionVisibilityContext) => boolean | Promise<boolean>;

	/**
	 * Hide the extension entirely (useful for conditional registration).
	 */
	hidden?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extension Definition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Definition for an extension contributed to a slot.
 * Extensions can be Angular components, React components (via bridge), or any framework.
 */
export interface PageExtensionDefinition<T = unknown>
	extends ExtensionLifecycleHooks,
		ExtensionVisibilityConfig {
	/** Unique id for this extension (e.g. 'my-plugin-widget'). */
	id: string;

	/** Slot this extension contributes to. */
	slotId: PageExtensionSlotId;

	/** Angular component to render (or wrapper component for React/Vue). */
	component?: Type<unknown>;

	/** Optional static config/props passed to the component. */
	config?: T;

	/** Optional order hint (lower = earlier). */
	order?: number;

	/**
	 * Wrapper configuration for consistent styling.
	 * Use 'card', 'widget', 'window', 'panel', or custom component.
	 */
	wrapper?: ExtensionWrapperType | ExtensionWrapperConfig;

	/**
	 * Framework identifier (e.g., 'react', 'vue', 'angular').
	 * Used for lazy loading the appropriate bridge.
	 */
	frameworkId?: string;

	/**
	 * Plugin ID that registered this extension.
	 * Set automatically during registration.
	 */
	pluginId?: string;

	/**
	 * Metadata for the extension (title, description, icon, etc.).
	 */
	metadata?: ExtensionMetadata;
}

/**
 * Metadata for an extension.
 */
export interface ExtensionMetadata {
	/** Display title */
	title?: string;
	/** Description */
	description?: string;
	/** Icon (Nebular icon name or URL) */
	icon?: string;
	/** Category for grouping */
	category?: string;
	/** Tags for filtering */
	tags?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Slot Definition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Definition for a dynamic extension slot.
 * Allows plugins to create their own extension points.
 */
export interface PageExtensionSlotDefinition {
	/** Unique slot identifier */
	id: PageExtensionSlotId;
	/** Display name for the slot */
	name?: string;
	/** Description of what this slot is for */
	description?: string;
	/** Plugin that registered this slot */
	pluginId?: string;
	/** Whether multiple extensions are allowed */
	multiple?: boolean;
	/** Default wrapper for extensions in this slot */
	defaultWrapper?: ExtensionWrapperType | ExtensionWrapperConfig;
	/** Maximum number of extensions allowed (0 = unlimited) */
	maxExtensions?: number;
}
