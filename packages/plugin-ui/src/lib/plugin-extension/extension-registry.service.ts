import { Injectable } from '@angular/core';
import { ExtensionDefinition, ExtensionSlotId } from './extension-slot.types';

/**
 * Registry for UI extensions contributed by plugins or other packages.
 *
 * Plugins register extensions for named slots; host components query
 * and render them (e.g. dashboard widgets, settings tabs).
 *
 * @example
 * ```ts
 * // In a plugin module constructor:
 * this.extRegistry.register({
 *   id: 'my-dashboard-widget',
 *   slotId: EXTENSION_SLOTS.DASHBOARD_WIDGETS,
 *   component: MyWidgetComponent,
 *   order: 10
 * });
 *
 * // In a host component template:
 * @for (ext of extRegistry.getExtensions(EXTENSION_SLOTS.DASHBOARD_WIDGETS); track ext.id) {
 *   <ng-container *ngComponentOutlet="ext.component; inputs: ext.config" />
 * }
 * ```
 */
/**
 * Extended registration options for tracking plugin ownership.
 */
export interface ExtensionRegistrationOptions {
	/** Plugin ID that owns this extension; used for deregisterByPlugin(). */
	pluginId?: string;
}

@Injectable({ providedIn: 'root' })
export class PageExtensionRegistryService {
	private readonly _extensions = new Map<ExtensionSlotId, ExtensionDefinition[]>();
	private readonly _pluginToExtensions = new Map<string, Array<{ slotId: ExtensionSlotId; extensionId: string }>>();

	/**
	 * Registers an extension for a slot.
	 * @param extension The extension definition.
	 * @param options Optional pluginId for lifecycle cleanup.
	 */
	register(extension: ExtensionDefinition, options?: ExtensionRegistrationOptions): void {
		const slotId = extension.slotId;
		const list = this._extensions.get(slotId) ?? [];
		const idx = list.findIndex((e) => e.id === extension.id);
		if (idx !== -1) {
			list[idx] = extension;
		} else {
			list.push(extension);
		}
		list.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
		this._extensions.set(slotId, list);
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
	 * @param extensions Array of extension definitions.
	 * @param options Optional pluginId for lifecycle cleanup.
	 */
	registerAll(extensions: ExtensionDefinition[], options?: ExtensionRegistrationOptions): void {
		extensions.forEach((e) => {
			this.register(e, options);
		});
	}

	/**
	 * Returns all extensions for a slot, sorted by order.
	 */
	getExtensions(slotId: ExtensionSlotId): ExtensionDefinition[] {
		return this._extensions.get(slotId) ?? [];
	}

	/**
	 * Removes an extension by id and slot.
	 */
	deregister(slotId: ExtensionSlotId, extensionId: string): void {
		const list = this._extensions.get(slotId);
		if (list) {
			const filtered = list.filter((e) => e.id !== extensionId);
			if (filtered.length === 0) {
				this._extensions.delete(slotId);
			} else {
				this._extensions.set(slotId, filtered);
			}
		}
	}

	/**
	 * Removes all extensions for a slot.
	 */
	deregisterAll(slotId: ExtensionSlotId): void {
		this._extensions.delete(slotId);
	}

	/**
	 * Removes all extensions registered by a specific plugin.
	 * Call this from ngOnPluginDestroy when the plugin registered extensions with pluginId.
	 */
	deregisterByPlugin(pluginId: string): void {
		const entries = this._pluginToExtensions.get(pluginId);
		if (entries) {
			for (const { slotId, extensionId } of entries) {
				this.deregister(slotId, extensionId);
			}
			this._pluginToExtensions.delete(pluginId);
		}
	}
}
