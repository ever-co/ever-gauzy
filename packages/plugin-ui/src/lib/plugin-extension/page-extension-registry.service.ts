import { inject, Injectable, Injector } from '@angular/core';
import { BehaviorSubject, Observable, map, distinctUntilChanged } from 'rxjs';
import {
	PageExtensionDefinition,
	PageExtensionSlotId,
	PageExtensionSlotDefinition,
	ExtensionVisibilityContext
} from './page-extension-slot.types';

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

	// Extension storage with BehaviorSubject for reactivity
	private readonly _extensions$ = new BehaviorSubject<Map<PageExtensionSlotId, PageExtensionDefinition[]>>(
		new Map()
	);

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
		const slotId = extension.slotId;
		const list = [...(extensions.get(slotId) ?? [])];

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

		extensions.set(slotId, list);
		this._extensions$.next(extensions);

		// Track for plugin cleanup
		if (options?.pluginId) {
			const entries = this._pluginToExtensions.get(options.pluginId) ?? [];
			if (!entries.some((e) => e.slotId === slotId && e.extensionId === extension.id)) {
				entries.push({ slotId, extensionId: extension.id });
				this._pluginToExtensions.set(options.pluginId, entries);
			}
		}
	}

	/**
	 * Registers multiple extensions.
	 *
	 * @param extensions Array of extension definitions
	 * @param options Optional pluginId for lifecycle cleanup
	 */
	registerAll(extensions: PageExtensionDefinition[], options?: ExtensionRegistrationOptions): void {
		extensions.forEach((e) => this.register(e, options));
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
	 * Returns an Observable of extensions for a slot (reactive).
	 * Updates automatically when extensions are registered/unregistered.
	 *
	 * @param slotId Slot ID to observe
	 * @returns Observable of extensions array
	 */
	getExtensions$(slotId: PageExtensionSlotId): Observable<PageExtensionDefinition[]> {
		return this._extensions$.pipe(
			map((extensions) => extensions.get(slotId) ?? []),
			distinctUntilChanged((prev, curr) => {
				if (prev.length !== curr.length) return false;
				return prev.every((p, i) => p.id === curr[i]?.id);
			})
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
	 */
	deregisterByPlugin(pluginId: string): void {
		// Deregister extensions
		const entries = this._pluginToExtensions.get(pluginId);
		if (entries) {
			for (const { slotId, extensionId } of entries) {
				this.deregister(slotId, extensionId);
			}
			this._pluginToExtensions.delete(pluginId);
		}

		// Deregister slots
		const slotIds = this._pluginToSlots.get(pluginId);
		if (slotIds) {
			for (const slotId of slotIds) {
				this.unregisterSlot(slotId);
			}
			this._pluginToSlots.delete(pluginId);
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
	 */
	private _isExtensionVisibleSync(ext: PageExtensionDefinition, context: ExtensionVisibilityContext): boolean {
		if (ext.hidden) {
			return false;
		}

		// Skip async checks in sync version
		if (ext.visible || ext.permissions?.length || ext.permissionsAny?.length || ext.featureKey) {
			// For extensions with async visibility, always show and let the component handle it
			// Or use getVisibleExtensions() for proper async filtering
			return true;
		}

		return true;
	}

	/**
	 * Checks permissions (placeholder - integrate with your permission service).
	 */
	private async _checkPermissions(
		permissions: string[],
		_context: ExtensionVisibilityContext,
		mode: 'all' | 'any'
	): Promise<boolean> {
		// TODO: Integrate with NgxPermissionsService or your permission system
		// For now, return true to not block extensions
		// Example integration:
		// const permissionService = context.injector.get(NgxPermissionsService);
		// if (mode === 'all') {
		//   return await permissionService.hasPermission(permissions);
		// } else {
		//   for (const perm of permissions) {
		//     if (await permissionService.hasPermission(perm)) return true;
		//   }
		//   return false;
		// }
		console.debug(`[ExtensionRegistry] Checking permissions (${mode}):`, permissions);
		return true;
	}

	/**
	 * Checks feature flag (placeholder - integrate with your feature service).
	 */
	private async _checkFeature(featureKey: string, _context: ExtensionVisibilityContext): Promise<boolean> {
		// TODO: Integrate with your feature flag service
		// Example integration:
		// const featureService = context.injector.get(FeatureStoreService);
		// return featureService.isFeatureEnabled(featureKey);
		console.debug(`[ExtensionRegistry] Checking feature:`, featureKey);
		return true;
	}
}
