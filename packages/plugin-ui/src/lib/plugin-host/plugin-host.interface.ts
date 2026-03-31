import { InjectionToken } from '@angular/core';

// ─────────────────────────────────────────────────────────────────────────────
// Navigation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Navigation API available to plugins.
 */
export interface IPluginNavigation {
	/** Navigate to a route using Angular Router commands. */
	navigate(commands: string[], extras?: { queryParams?: Record<string, unknown> }): Promise<boolean>;
	/** Get the current active URL. */
	getCurrentRoute(): string;
	/** Navigate back in history. */
	back(): void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────────────────────

export interface IPluginNotificationOptions {
	/** Duration in milliseconds. 0 = persist until dismissed. */
	duration?: number;
	/** Whether the user can dismiss the notification. */
	closable?: boolean;
}

/**
 * Notifications/toast API available to plugins.
 */
export interface IPluginNotifications {
	success(message: string, title?: string, options?: IPluginNotificationOptions): void;
	error(message: string, title?: string, options?: IPluginNotificationOptions): void;
	info(message: string, title?: string, options?: IPluginNotificationOptions): void;
	warning(message: string, title?: string, options?: IPluginNotificationOptions): void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dialogs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dialog API available to plugins.
 */
export interface IPluginDialogs {
	/** Show a yes/no confirmation dialog. Returns true if confirmed. */
	confirm(message: string, title?: string): Promise<boolean>;
	/** Show an alert dialog. */
	alert(message: string, title?: string): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// User / Organization Context
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimal user context for plugins.
 * The host app provides the full user object, but plugins
 * receive this minimal interface to avoid tight coupling.
 */
export interface IPluginUserContext {
	id: string;
	name: string;
	email?: string;
	role?: string;
	imageUrl?: string;
}

/**
 * Minimal organization context for plugins.
 */
export interface IPluginOrganizationContext {
	id: string;
	name: string;
	imageUrl?: string;
}

/**
 * Auth / identity API available to plugins.
 */
export interface IPluginUser {
	/** Get current logged-in user, or null if not authenticated. */
	getCurrentUser(): IPluginUserContext | null;
	/** Get current organization, or null if not set. */
	getCurrentOrganization(): IPluginOrganizationContext | null;
	/** Whether the user has the given permission key. */
	hasPermission(permissionKey: string): boolean;
	/** Whether the given feature flag is enabled. */
	isFeatureEnabled(featureKey: string): boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Host API Aggregate
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Unified Host API facade for plugin developers.
 *
 * Provides a stable, framework-agnostic API for common operations.
 * The host application provides the implementation; plugins consume it
 * via inject(PLUGIN_HOST_API) or the usePluginHost() React hook.
 *
 * @example Angular:
 * ```ts
 * const host = inject(PLUGIN_HOST_API);
 * host.notifications.success('Saved!');
 * host.navigation.navigate(['/pages/dashboard']);
 * ```
 *
 * @example React:
 * ```tsx
 * const host = usePluginHost();
 * host?.notifications.success('Saved!');
 * ```
 */
export interface IPluginHostAPI {
	navigation: IPluginNavigation;
	notifications: IPluginNotifications;
	dialogs: IPluginDialogs;
	user: IPluginUser;
}

/**
 * InjectionToken for the plugin host API.
 *
 * The host application provides this in the root module:
 * ```ts
 * { provide: PLUGIN_HOST_API, useClass: PluginHostService }
 * ```
 */
export const PLUGIN_HOST_API = new InjectionToken<IPluginHostAPI>('PLUGIN_HOST_API');
