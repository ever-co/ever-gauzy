import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import type { PluginSettingsSchema, PluginSettingField } from '../plugin-ui.types';

/**
 * Registered plugin settings entry.
 */
export interface PluginSettingsEntry {
	/** Plugin ID. */
	pluginId: string;
	/** Settings schema from the plugin definition. */
	schema: PluginSettingsSchema;
	/** Current settings values (persisted via PluginSettingsStorageService). */
	values: Record<string, unknown>;
}

/**
 * Abstract storage interface for plugin settings persistence.
 * The app provides a concrete implementation (e.g. localStorage, API-backed).
 *
 * @example
 * ```ts
 * @Injectable({ providedIn: 'root' })
 * export class LocalStorageSettingsStorage implements IPluginSettingsStorage {
 *   async load(pluginId: string): Promise<Record<string, unknown>> {
 *     const raw = localStorage.getItem(`plugin-settings:${pluginId}`);
 *     return raw ? JSON.parse(raw) : {};
 *   }
 *   async save(pluginId: string, values: Record<string, unknown>): Promise<void> {
 *     localStorage.setItem(`plugin-settings:${pluginId}`, JSON.stringify(values));
 *   }
 * }
 * ```
 */
export abstract class IPluginSettingsStorage {
	/** Load settings values for a plugin. Returns empty object if none saved. */
	abstract load(pluginId: string): Promise<Record<string, unknown>>;
	/** Persist settings values for a plugin. */
	abstract save(pluginId: string, values: Record<string, unknown>): Promise<void>;
}

/**
 * Registry for plugin settings.
 *
 * Collects settings schemas from plugin definitions and manages
 * settings values with optional persistence.
 *
 * @example
 * ```ts
 * // Register settings (done automatically by defineDeclarativePlugin)
 * settingsRegistry.register('my-plugin', schema);
 *
 * // Read a setting value
 * const autoStart = settingsRegistry.getValue<boolean>('my-plugin', 'autoStart');
 *
 * // Update a setting
 * settingsRegistry.setValue('my-plugin', 'autoStart', true);
 *
 * // Observe settings changes
 * settingsRegistry.getValues$('my-plugin').subscribe(values => {
 *   console.log('Settings changed:', values);
 * });
 * ```
 */
@Injectable({ providedIn: 'root' })
export class PluginSettingsRegistryService {
	private readonly _entries$ = new BehaviorSubject<Map<string, PluginSettingsEntry>>(new Map());

	private _storage: IPluginSettingsStorage | null = null;

	/**
	 * Sets the storage backend for persisting settings.
	 * Call once during app initialization.
	 */
	setStorage(storage: IPluginSettingsStorage): void {
		this._storage = storage;
	}

	// ─── Registration ───────────────────────────────────────────────────────

	/**
	 * Registers a plugin's settings schema.
	 * Loads persisted values if a storage backend is configured.
	 */
	async register(pluginId: string, schema: PluginSettingsSchema): Promise<void> {
		// Build default values from fields
		const defaults: Record<string, unknown> = {};
		if (schema.fields) {
			for (const field of schema.fields) {
				if (field.defaultValue !== undefined) {
					defaults[field.key] = field.defaultValue;
				}
			}
		}

		// Load persisted values
		let persisted: Record<string, unknown> = {};
		if (this._storage) {
			try {
				persisted = await this._storage.load(pluginId);
			} catch (error) {
				console.error(`[PluginSettings] Failed to load settings for '${pluginId}':`, error);
			}
		}

		const entry: PluginSettingsEntry = {
			pluginId,
			schema,
			values: { ...defaults, ...persisted }
		};

		const entries = new Map(this._entries$.value);
		entries.set(pluginId, entry);
		this._entries$.next(entries);
	}

	/**
	 * Unregisters a plugin's settings.
	 */
	unregister(pluginId: string): void {
		const entries = new Map(this._entries$.value);
		entries.delete(pluginId);
		this._entries$.next(entries);
	}

	// ─── Read ───────────────────────────────────────────────────────────────

	/**
	 * Gets the settings entry for a plugin.
	 */
	getEntry(pluginId: string): Readonly<PluginSettingsEntry> | undefined {
		const entry = this._entries$.value.get(pluginId);
		return entry ? { ...entry, values: { ...entry.values } } : undefined;
	}

	/**
	 * Gets all settings values for a plugin.
	 */
	getValues(pluginId: string): Readonly<Record<string, unknown>> {
		const values = this._entries$.value.get(pluginId)?.values;
		return values ? { ...values } : {};
	}

	/**
	 * Gets a single setting value.
	 */
	getValue<T>(pluginId: string, key: string): T | undefined {
		return this.getValues(pluginId)[key] as T | undefined;
	}

	/**
	 * Gets a setting value with a default fallback.
	 */
	getValueOrDefault<T>(pluginId: string, key: string, defaultValue: T): T {
		const value = this.getValue<T>(pluginId, key);
		return value !== undefined ? value : defaultValue;
	}

	/**
	 * Observable of all settings values for a plugin (reactive).
	 */
	getValues$(pluginId: string): Observable<Record<string, unknown>> {
		return this._entries$.pipe(
			map((entries) => entries.get(pluginId)?.values ?? {})
		);
	}

	/**
	 * Observable of a single setting value (reactive).
	 */
	getValue$<T>(pluginId: string, key: string): Observable<T | undefined> {
		return this.getValues$(pluginId).pipe(
			map((values) => values[key] as T | undefined)
		);
	}

	/**
	 * Gets the schema for a plugin.
	 */
	getSchema(pluginId: string): PluginSettingsSchema | undefined {
		return this._entries$.value.get(pluginId)?.schema;
	}

	/**
	 * Gets the field definitions for a plugin.
	 */
	getFields(pluginId: string): PluginSettingField[] {
		return this._entries$.value.get(pluginId)?.schema.fields ?? [];
	}

	// ─── Write ──────────────────────────────────────────────────────────────

	/**
	 * Sets a single setting value and persists.
	 */
	async setValue(pluginId: string, key: string, value: unknown): Promise<void> {
		const entries = new Map(this._entries$.value);
		const entry = entries.get(pluginId);
		if (!entry) {
			console.warn(`[PluginSettings] No settings registered for '${pluginId}'.`);
			return;
		}

		entry.values = { ...entry.values, [key]: value };
		entries.set(pluginId, { ...entry });
		this._entries$.next(entries);

		await this._persist(pluginId, entry.values);
	}

	/**
	 * Sets multiple settings values at once and persists.
	 */
	async setValues(pluginId: string, values: Record<string, unknown>): Promise<void> {
		const entries = new Map(this._entries$.value);
		const entry = entries.get(pluginId);
		if (!entry) {
			console.warn(`[PluginSettings] No settings registered for '${pluginId}'.`);
			return;
		}

		entry.values = { ...entry.values, ...values };
		entries.set(pluginId, { ...entry });
		this._entries$.next(entries);

		await this._persist(pluginId, entry.values);
	}

	/**
	 * Resets all settings to defaults for a plugin and persists.
	 */
	async resetToDefaults(pluginId: string): Promise<void> {
		const entry = this._entries$.value.get(pluginId);
		if (!entry) return;

		const defaults: Record<string, unknown> = {};
		if (entry.schema.fields) {
			for (const field of entry.schema.fields) {
				if (field.defaultValue !== undefined) {
					defaults[field.key] = field.defaultValue;
				}
			}
		}

		const entries = new Map(this._entries$.value);
		entries.set(pluginId, { ...entry, values: defaults });
		this._entries$.next(entries);

		await this._persist(pluginId, defaults);
	}

	// ─── Query ──────────────────────────────────────────────────────────────

	/**
	 * Returns all registered plugin settings entries.
	 */
	getAll(): PluginSettingsEntry[] {
		return Array.from(this._entries$.value.values());
	}

	/**
	 * Observable of all registered plugin settings entries.
	 */
	get all$(): Observable<PluginSettingsEntry[]> {
		return this._entries$.pipe(map((entries) => Array.from(entries.values())));
	}

	/**
	 * Returns plugin IDs that have settings registered.
	 */
	getPluginIds(): string[] {
		return Array.from(this._entries$.value.keys());
	}

	/**
	 * Checks if a plugin has settings registered.
	 */
	has(pluginId: string): boolean {
		return this._entries$.value.has(pluginId);
	}

	// ─── Private ────────────────────────────────────────────────────────────

	private async _persist(pluginId: string, values: Record<string, unknown>): Promise<void> {
		if (!this._storage) return;
		try {
			await this._storage.save(pluginId, values);
		} catch (error) {
			console.error(`[PluginSettings] Failed to save settings for '${pluginId}':`, error);
		}
	}
}
