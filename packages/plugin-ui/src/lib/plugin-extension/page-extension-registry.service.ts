import { inject, Injectable, Injector } from '@angular/core';
import { BehaviorSubject, Observable, map, distinctUntilChanged } from 'rxjs';
import {
	PageExtensionDefinition,
	PageExtensionSlotId,
	PageExtensionSlotDefinition,
	ExtensionVisibilityContext
} from './page-extension-slot.types';
import {
	PLUGIN_PERMISSION_CHECKER,
	PLUGIN_FEATURE_CHECKER,
	type IPluginPermissionChecker,
	type IPluginFeatureChecker
} from '../plugin-ui.helper';

/**
 * Extended registration options for tracking plugin ownership.
 */
export interface ExtensionRegistrationOptions {
	/** Plugin ID that owns this extension; used for deregisterByPlugin(). */
	pluginId?: string;
}

/**
 * Options for slot registration.
 */
export interface SlotRegistrationOptions {
	/** Plugin ID that owns this slot */
	pluginId?: string;
	/** Whether to throw if slot already exists */
	throwIfExists?: boolean;
}

/**
 * Registry for UI extensions contributed by plugins or other packages.
 *
 * Provides reactive extension management with Observable support for
 * automatic UI updates when extensions are registered/unregistered.
 *
 * @example
 * ```ts
 * // Register an extension
 * registry.register({
 *   id: 'my-dashboard-widget',
 *   slotId: PAGE_EXTENSION_SLOTS.DASHBOARD_WIDGETS,
 *   component: MyWidgetComponent,
 *   order: 10
 * });
 *
 * // Subscribe to extension changes (reactive)
 * registry.getExtensions$('dashboard-widgets').subscribe(extensions => {
 *   console.log('Extensions updated:', extensions);
 * });
 *
 * // Dynamic slot registration
 * registry.registerSlot({
 *   id: 'my-plugin:custom-area',
 *   name: 'Custom Plugin Area',
 *   multiple: true
 * });
 * ```
 */
@Injectable({ providedIn: 'root' })
export class PageExtensionRegistryService {
	private readonly _injector = inject(Injector);
	private readonly _permissionChecker: IPluginPermissionChecker | null =
		inject(PLUGIN_PERMISSION_CHECKER, { optional: true }) ?? null;
	private readonly _featureChecker: IPluginFeatureChecker | null =
		inject(PLUGIN_FEATURE_CHECKER, { optional: true }) ?? null;

	// Extension storage with BehaviorSubject for reactivity
	private readonly _extensions$ = new BehaviorSubject<Map<PageExtensionSlotId, PageExtensionDefinition[]>>(new Map());

	// Slot definitions for dynamic slots
	private readonly _slots$ = new BehaviorSubject<Map<PageExtensionSlotId, PageExtensionSlotDefinition>>(new Map());

	// Plugin to extension mapping for cleanup
	private readonly _pluginToExtensions = new Map<
		string,
		Array<{ slotId: PageExtensionSlotId; extensionId: string }>
	>();

	// Plugin to slot mapping for cleanup
	private readonly _pluginToSlots = new Map<string, PageExtensionSlotId[]>();

	// ─────────────────────────────────────────────────────────────────────────
	// Slot Registration (Dynamic Slot Registration - Enhancement #4)
	// ─────────────────────────────────────────────────────────────────────────

	/**
	 * Registers a new extension slot.
	 * Allows plugins to create their own extension points.
	 *
	 * @param slot Slot definition
	 * @param options Registration options
	 */
	registerSlot(slot: PageExtensionSlotDefinition, options?: SlotRegistrationOptions): void {
		const slots = new Map(this._slots$.value);
		if (slots.has(slot.id) && options?.throwIfExists) {
			throw new Error(`Extension slot '${slot.id}' already exists`);
		}
		slots.set(slot.id, { ...slot, pluginId: options?.pluginId ?? slot.pluginId });
		this._slots$.next(slots);

		// Track for plugin cleanup
		if (options?.pluginId) {
			const pluginSlots = this._pluginToSlots.get(options.pluginId) ?? [];
			if (!pluginSlots.includes(slot.id)) {
				pluginSlots.push(slot.id);
				this._pluginToSlots.set(options.pluginId, pluginSlots);
			}
		}
	}

	/**
	 * Gets a slot definition.
	 */
	getSlot(slotId: PageExtensionSlotId): PageExtensionSlotDefinition | undefined {
		return this._slots$.value.get(slotId);
	}

	/**
	 * Returns all registered slot definition IDs (from `registerSlot()`).
	 * These may have zero extensions — use alongside `getSlotIds()` for a complete picture.
	 */
	getRegisteredSlotIds(): PageExtensionSlotId[] {
		return Array.from(this._slots$.value.keys());
	}

	/**
	 * Observable of all registered slots.
	 */
	get slots$(): Observable<PageExtensionSlotDefinition[]> {
		return this._slots$.pipe(map((slots) => Array.from(slots.values())));
	}

	/**
	 * Unregisters a slot.
	 */
	unregisterSlot(slotId: PageExtensionSlotId): void {
		const slots = new Map(this._slots$.value);
		slots.delete(slotId);
		this._slots$.next(slots);

		// Also remove all extensions for this slot
		this.deregisterAll(slotId);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Extension Registration
	// ─────────────────────────────────────────────────────────────────────────

	/**
	 * Registers an extension for a slot.
	 *
	 * @param extension The extension definition
	 * @param options Optional pluginId for lifecycle cleanup
	 */
	register(extension: PageExtensionDefinition, options?: ExtensionRegistrationOptions): void {
		const extensions = new Map(this._extensions$.value);
		this._registerTo(extension, extensions, options);
		this._extensions$.next(extensions);
	}

	/**
	 * Registers multiple extensions.
	 *
	 * @param extensions Array of extension definitions
	 * @param options Optional pluginId for lifecycle cleanup
	 */
	registerAll(extensions: PageExtensionDefinition[], options?: ExtensionRegistrationOptions): void {
		const extensionsMap = new Map(this._extensions$.value);
		extensions.forEach((e) => this._registerTo(e, extensionsMap, options));
		this._extensions$.next(extensionsMap);
	}

	/**
	 * Internal helper to register an extension to a specific map instance.
	 */
	private _registerTo(
		extension: PageExtensionDefinition,
		extensionsMap: Map<PageExtensionSlotId, PageExtensionDefinition[]>,
		options?: ExtensionRegistrationOptions
	): void {
		const slotId = extension.slotId;
		const list = [...(extensionsMap.get(slotId) ?? [])];

		// Add plugin ID to extension
		const extWithPlugin: PageExtensionDefinition = {
			...extension,
			pluginId: options?.pluginId ?? extension.pluginId
		};

		// Update or add
		const idx = list.findIndex((e) => e.id === extension.id);
		if (idx !== -1) {
			list[idx] = extWithPlugin;
		} else {
			list.push(extWithPlugin);
		}

		// Sort by order
		list.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

		// Check slot max extensions
		const slot = this._slots$.value.get(slotId);
		if (slot?.maxExtensions && slot.maxExtensions > 0 && list.length > slot.maxExtensions) {
			console.warn(
				`Slot '${slotId}' has reached max extensions (${slot.maxExtensions}). ` +
					`Extension '${extension.id}' may not be displayed.`
			);
		}

		extensionsMap.set(slotId, list);

		// Track for plugin cleanup
		if (options?.pluginId) {
			const entries = this._pluginToExtensions.get(options.pluginId) ?? [];
			if (!entries.some((e) => e.slotId === slotId && e.extensionId === extension.id)) {
				entries.push({ slotId, extensionId: extension.id });
				this._pluginToExtensions.set(options.pluginId, entries);
			}
		}
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Extension Retrieval (Reactive - Enhancement #1)
	// ─────────────────────────────────────────────────────────────────────────

	/**
	 * Returns all extensions for a slot (non-reactive).
	 */
	getExtensions(slotId: PageExtensionSlotId): PageExtensionDefinition[] {
		return this._extensions$.value.get(slotId) ?? [];
	}

	/**
	 * Returns all slot IDs that have at least one registered extension.
	 * Includes dynamically registered extensions, not just static config.
	 */
	getSlotIds(): PageExtensionSlotId[] {
		return Array.from(this._extensions$.value.keys());
	}

	/**
	 * Returns an Observable of extensions for a slot (reactive).
	 * Updates automatically when extensions are registered/unregistered.
	 *
	 * @param slotId Slot ID to observe
	 * @returns Observable of extensions array
	 */
	getExtensions$(slotId: PageExtensionSlotId): Observable<PageExtensionDefinition[]> {
		return this._extensions$.pipe(
			map((extensions) => extensions.get(slotId)),
			distinctUntilChanged(),
			map((extensions) => extensions ?? [])
		);
	}

	/**
	 * Returns visible extensions for a slot, applying visibility filters.
	 * (Enhancement #3 - Visibility Control)
	 *
	 * @param slotId Slot ID
	 * @param context Visibility context with user/organization data
	 * @returns Promise of visible extensions
	 */
	async getVisibleExtensions(
		slotId: PageExtensionSlotId,
		context?: Partial<ExtensionVisibilityContext>
	): Promise<PageExtensionDefinition[]> {
		const extensions = this.getExtensions(slotId);
		const visibleExtensions: PageExtensionDefinition[] = [];

		const visibilityContext: ExtensionVisibilityContext = {
			injector: this._injector,
			user: context?.user,
			organization: context?.organization,
			data: context?.data
		};

		for (const ext of extensions) {
			if (await this._isExtensionVisible(ext, visibilityContext)) {
				visibleExtensions.push(ext);
			}
		}

		return visibleExtensions;
	}

	/**
	 * Returns an Observable of visible extensions with reactive updates.
	 */
	getVisibleExtensions$(
		slotId: PageExtensionSlotId,
		context?: Partial<ExtensionVisibilityContext>
	): Observable<PageExtensionDefinition[]> {
		return this.getExtensions$(slotId).pipe(
			map((extensions) => {
				// Note: For async visibility checks, use getVisibleExtensions() instead
				// This sync version only checks synchronous visibility conditions
				const visibilityContext: ExtensionVisibilityContext = {
					injector: this._injector,
					user: context?.user,
					organization: context?.organization,
					data: context?.data
				};
				return extensions.filter((ext) => this._isExtensionVisibleSync(ext, visibilityContext));
			})
		);
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Extension Removal
	// ─────────────────────────────────────────────────────────────────────────

	/**
	 * Removes an extension by id and slot.
	 */
	deregister(slotId: PageExtensionSlotId, extensionId: string): void {
		const extensions = new Map(this._extensions$.value);
		const list = extensions.get(slotId);
		if (list) {
			const filtered = list.filter((e) => e.id !== extensionId);
			if (filtered.length === 0) {
				extensions.delete(slotId);
			} else {
				extensions.set(slotId, filtered);
			}
			this._extensions$.next(extensions);
		}
	}

	/**
	 * Removes all extensions for a slot.
	 */
	deregisterAll(slotId: PageExtensionSlotId): void {
		const extensions = new Map(this._extensions$.value);
		extensions.delete(slotId);
		this._extensions$.next(extensions);
	}

	/**
	 * Removes all extensions registered by a specific plugin.
	 * Call this from ngOnPluginDestroy when the plugin registered extensions with pluginId.
	 *
	 * Batches all mutations into single emissions to avoid N+M intermediate
	 * state updates that would trigger unnecessary change detection cycles.
	 */
	deregisterByPlugin(pluginId: string): void {
		let extensionsChanged = false;
		let slotsChanged = false;

		// Batch-remove extensions (single _extensions$ emit)
		const entries = this._pluginToExtensions.get(pluginId);
		if (entries?.length) {
			const extensions = new Map(this._extensions$.value);
			for (const { slotId, extensionId } of entries) {
				const list = extensions.get(slotId);
				if (list) {
					const filtered = list.filter((e) => e.id !== extensionId);
					if (filtered.length === 0) {
						extensions.delete(slotId);
					} else {
						extensions.set(slotId, filtered);
					}
					extensionsChanged = true;
				}
			}
			this._pluginToExtensions.delete(pluginId);
			if (extensionsChanged) {
				this._extensions$.next(extensions);
			}
		}

		// Batch-remove slots (single _slots$ emit)
		const slotIds = this._pluginToSlots.get(pluginId);
		if (slotIds?.length) {
			const slots = new Map(this._slots$.value);
			const extensions = new Map(this._extensions$.value);
			let extensionsChangedAgain = false;

			for (const slotId of slotIds) {
				slots.delete(slotId);
				slotsChanged = true;
				// Also remove extensions for this slot
				if (extensions.has(slotId)) {
					extensions.delete(slotId);
					extensionsChangedAgain = true;
				}
			}
			this._pluginToSlots.delete(pluginId);
			if (slotsChanged) {
				this._slots$.next(slots);
			}
			if (extensionsChangedAgain) {
				this._extensions$.next(extensions);
			}
		}
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Visibility Helpers (Enhancement #3)
	// ─────────────────────────────────────────────────────────────────────────

	/**
	 * Checks if an extension is visible (async version).
	 */
	private async _isExtensionVisible(
		ext: PageExtensionDefinition,
		context: ExtensionVisibilityContext
	): Promise<boolean> {
		// Check hidden flag
		if (ext.hidden) {
			return false;
		}

		// Check custom visibility function
		if (ext.visible) {
			const result = ext.visible(context);
			if (result instanceof Promise) {
				return await result;
			}
			return result;
		}

		// Check permissions (all required)
		if (ext.permissions?.length) {
			const hasAllPermissions = await this._checkPermissions(ext.permissions, context, 'all');
			if (!hasAllPermissions) return false;
		}

		// Check permissions (any required)
		if (ext.permissionsAny?.length) {
			const hasAnyPermission = await this._checkPermissions(ext.permissionsAny, context, 'any');
			if (!hasAnyPermission) return false;
		}

		// Check feature flag
		if (ext.featureKey) {
			const featureEnabled = await this._checkFeature(ext.featureKey, context);
			if (!featureEnabled) return false;
		}

		return true;
	}

	/**
	 * Checks if an extension is visible (sync version for Observable).
	 * Uses injected permission/feature checkers when available (both are synchronous).
	 * Falls back to showing the extension when checkers are not configured.
	 */
	private _isExtensionVisibleSync(ext: PageExtensionDefinition, _context: ExtensionVisibilityContext): boolean {
		if (ext.hidden) {
			return false;
		}

		// Custom visibility function — evaluate if sync, fall back to visible if async
		if (ext.visible) {
			const result = ext.visible(_context);
			if (result instanceof Promise) {
				// Async visibility can't be evaluated synchronously — show by default
				return true;
			}
			return result;
		}

		// Check permissions synchronously (IPluginPermissionChecker is sync)
		if (ext.permissions?.length && this._permissionChecker) {
			if (!this._permissionChecker.hasAllPermissions(...ext.permissions)) return false;
		}
		if (ext.permissionsAny?.length && this._permissionChecker) {
			if (!this._permissionChecker.hasAnyPermission(...ext.permissionsAny)) return false;
		}

		// Check feature flag synchronously (IPluginFeatureChecker is sync)
		if (ext.featureKey && this._featureChecker) {
			if (!this._featureChecker.isFeatureEnabled(ext.featureKey)) return false;
		}

		return true;
	}

	/**
	 * Checks user permissions via the injected PLUGIN_PERMISSION_CHECKER.
	 * Falls back to allowing access when no checker is provided.
	 */
	private async _checkPermissions(
		permissions: string[],
		_context: ExtensionVisibilityContext,
		mode: 'all' | 'any'
	): Promise<boolean> {
		if (!this._permissionChecker) {
			// No permission checker configured — allow by default
			return true;
		}
		return mode === 'all'
			? this._permissionChecker.hasAllPermissions(...permissions)
			: this._permissionChecker.hasAnyPermission(...permissions);
	}

	/**
	 * Checks a feature flag via the injected PLUGIN_FEATURE_CHECKER.
	 * Falls back to allowing access when no checker is provided.
	 */
	private async _checkFeature(featureKey: string, _context: ExtensionVisibilityContext): Promise<boolean> {
		if (!this._featureChecker) {
			// No feature checker configured — allow by default
			return true;
		}
		return this._featureChecker.isFeatureEnabled(featureKey);
	}
}
