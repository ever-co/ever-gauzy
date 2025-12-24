import { Injectable } from '@angular/core';
import { QueryEntity } from '@datorama/akita';
import { combineLatest, map, Observable } from 'rxjs';
import {
	IPluginSetting,
	IPluginSettingGroup,
	PluginSettingScope,
	PluginSettingType
} from '../../../../services/plugin-settings.service';
import { PluginSettingsState, PluginSettingsStore } from '../stores/plugin-settings.store';

@Injectable({ providedIn: 'root' })
export class PluginSettingsQuery extends QueryEntity<PluginSettingsState, IPluginSetting> {
	constructor(protected override store: PluginSettingsStore) {
		super(store);
	}

	// Basic selectors
	readonly selectedPluginId$ = this.select((state) => state.ui.selectedPluginId);
	readonly selectedScope$ = this.select((state) => state.ui.selectedScope);
	readonly searchTerm$ = this.select((state) => state.ui.searchTerm);
	readonly selectedCategory$ = this.select((state) => state.ui.selectedCategory);
	readonly showAdvancedSettings$ = this.select((state) => state.ui.showAdvancedSettings);
	readonly hasUnsavedChanges$ = this.select((state) => state.ui.hasUnsavedChanges);
	// Edit mode selectors
	readonly editingSettings$ = this.select((state) => state.edit.editingSettings);
	readonly savingSettings$ = this.select((state) => state.edit.savingSettings);
	readonly editForms$ = this.select((state) => state.edit.editForms);
	// Loading states
	readonly isLoading$ = this.select((state) => state.loading);
	readonly isSaving$ = this.select((state) => state.saving);
	readonly isValidating$ = this.select((state) => state.validating);

	// Error states
	readonly errorMessage$ = this.select((state) => state.errorMessage);
	readonly validationErrors$ = this.select((state) => state.validationErrors);

	// Settings data
	readonly allSettings$ = this.selectAll();
	readonly settingsGroups$ = this.select((state) => state.settingsGroups);

	// Computed selectors
	readonly selectedPlugin$ = combineLatest([this.selectedPluginId$, this.selectedScope$]).pipe(
		map(([pluginId, scope]) => ({
			pluginId,
			scope
		}))
	);

	readonly filteredSettings$ = combineLatest([
		this.allSettings$,
		this.searchTerm$,
		this.selectedCategory$,
		this.showAdvancedSettings$
	]).pipe(
		map(([settings, searchTerm, selectedCategory, showAdvanced]) => {
			let filtered = settings;

			// Filter by search term
			if (searchTerm?.trim()) {
				const term = searchTerm.toLowerCase();
				filtered = filtered.filter(
					(setting) =>
						setting.key.toLowerCase().includes(term) ||
						setting.label?.toLowerCase().includes(term) ||
						setting.description?.toLowerCase().includes(term) ||
						setting.category?.toLowerCase().includes(term)
				);
			}

			// Filter by category
			if (selectedCategory && selectedCategory !== 'all') {
				filtered = filtered.filter((setting) => setting.category === selectedCategory);
			}

			// Filter by advanced settings visibility (using isVisible property)
			if (!showAdvanced) {
				filtered = filtered.filter((setting) => setting.isVisible);
			}

			return filtered;
		})
	);

	readonly settingsByCategory$: Observable<IPluginSettingGroup[]> = this.filteredSettings$.pipe(
		map((settings) => {
			const grouped = settings.reduce((acc, setting) => {
				const category = setting.category || 'general';
				if (!acc[category]) {
					acc[category] = [];
				}
				acc[category].push(setting);
				return acc;
			}, {} as Record<string, IPluginSetting[]>);

			return Object.entries(grouped).map(([category, categorySettings]) => ({
				category,
				label: this.formatCategoryLabel(category),
				description: '',
				icon: this.getCategoryIcon(category),
				order: 0,
				settings: categorySettings
			}));
		})
	);

	// Filtered groups from stored settingsGroups
	readonly filteredGroups$: Observable<IPluginSettingGroup[]> = combineLatest([
		this.settingsGroups$,
		this.searchTerm$,
		this.selectedCategory$,
		this.showAdvancedSettings$
	]).pipe(
		map(([groups, searchTerm, selectedCategory, showAdvanced]) => {
			return groups
				.map((group) => {
					let filteredSettings = group.settings;

					// Filter by search term
					if (searchTerm?.trim()) {
						const term = searchTerm.toLowerCase();
						filteredSettings = filteredSettings.filter(
							(setting) =>
								setting.key.toLowerCase().includes(term) ||
								setting.label?.toLowerCase().includes(term) ||
								setting.description?.toLowerCase().includes(term) ||
								setting.category?.toLowerCase().includes(term)
						);
					}

					// Filter by category
					if (selectedCategory && selectedCategory !== 'all') {
						filteredSettings = filteredSettings.filter((setting) => setting.category === selectedCategory);
					}

					// Filter by advanced settings visibility
					if (!showAdvanced) {
						filteredSettings = filteredSettings.filter((setting) => setting.isVisible !== false);
					}

					return {
						...group,
						settings: filteredSettings
					};
				})
				.filter((group) => group.settings.length > 0); // Only return groups with settings
		})
	);

	private formatCategoryLabel(category: string): string {
		return category
			.split('_')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(' ');
	}

	private getCategoryIcon(category: string): string {
		const icons: Record<string, string> = {
			general: 'settings-2-outline',
			security: 'shield-outline',
			api: 'code-outline',
			notification: 'bell-outline',
			display: 'monitor-outline',
			advanced: 'options-2-outline'
		};
		return icons[category.toLowerCase()] || 'folder-outline';
	}

	readonly settingsStatistics$ = this.filteredSettings$.pipe(
		map((settings) => {
			const total = settings.length;
			const byType = settings.reduce((acc, setting) => {
				acc[setting.type] = (acc[setting.type] || 0) + 1;
				return acc;
			}, {} as Record<PluginSettingType, number>);

			const byScope = settings.reduce((acc, setting) => {
				acc[setting.scope] = (acc[setting.scope] || 0) + 1;
				return acc;
			}, {} as Record<PluginSettingScope, number>);

			const configured = settings.filter((s) => s.value !== null && s.value !== undefined).length;
			const withDefaults = settings.filter((s) => s.defaultValue !== null && s.defaultValue !== undefined).length;
			const required = settings.filter((s) => s.isRequired).length;
			const encrypted = settings.filter((s) => s.isEncrypted).length;
			const visible = settings.filter((s) => s.isVisible).length;

			return {
				total,
				configured,
				withDefaults,
				required,
				encrypted,
				visible,
				byType,
				byScope
			};
		})
	);

	readonly categories$ = this.allSettings$.pipe(
		map((settings) => {
			const categories = new Set(settings.map((s) => s.category || 'general'));
			return Array.from(categories).sort();
		})
	);

	readonly hasValidationErrors$ = this.validationErrors$.pipe(map((errors) => Object.keys(errors).length > 0));

	readonly validationErrorsCount$ = this.validationErrors$.pipe(
		map((errors) => {
			return Object.values(errors).reduce((count, errorList) => {
				return count + (errorList?.length || 0);
			}, 0);
		})
	);

	readonly isFormValid$ = combineLatest([this.hasValidationErrors$, this.allSettings$]).pipe(
		map(([hasErrors, settings]) => {
			// Check for validation errors
			if (hasErrors) {
				return false;
			}

			// Check required fields
			const requiredFields = settings.filter((s) => s.isRequired);
			const missingRequired = requiredFields.some(
				(field) => field.value === null || field.value === undefined || field.value === ''
			);

			return !missingRequired;
		})
	);

	readonly hasChanges$ = combineLatest([this.hasUnsavedChanges$, this.allSettings$]).pipe(
		map(([hasUnsaved, settings]) => {
			if (hasUnsaved) {
				return true;
			}

			// Check if any setting has been modified from its original value
			return settings.some((setting) => {
				const originalValue = setting.defaultValue;
				const currentValue = setting.value;
				return JSON.stringify(originalValue) !== JSON.stringify(currentValue);
			});
		})
	);

	// Helper methods for specific settings queries
	getSettingById$(id: string): Observable<IPluginSetting | undefined> {
		return this.selectEntity(id);
	}

	getSettingByKey$(key: string): Observable<IPluginSetting | undefined> {
		return this.selectAll().pipe(map((settings) => settings.find((s) => s.key === key)));
	}

	getSettingsByCategory$(category: string): Observable<IPluginSetting[]> {
		return this.selectAll().pipe(map((settings) => settings.filter((s) => (s.category || 'general') === category)));
	}

	getSettingsByScope$(scope: PluginSettingScope): Observable<IPluginSetting[]> {
		return this.selectAll().pipe(map((settings) => settings.filter((s) => s.scope === scope)));
	}

	getSettingsByType$(type: PluginSettingType): Observable<IPluginSetting[]> {
		return this.selectAll().pipe(map((settings) => settings.filter((s) => s.type === type)));
	}

	getRequiredSettings$(): Observable<IPluginSetting[]> {
		return this.selectAll().pipe(map((settings) => settings.filter((s) => s.isRequired)));
	}

	getEncryptedSettings$(): Observable<IPluginSetting[]> {
		return this.selectAll().pipe(map((settings) => settings.filter((s) => s.isEncrypted)));
	}

	getModifiedSettings$(): Observable<IPluginSetting[]> {
		return this.selectAll().pipe(
			map((settings) =>
				settings.filter((setting) => {
					const originalValue = setting.defaultValue;
					const currentValue = setting.value;
					return JSON.stringify(originalValue) !== JSON.stringify(currentValue);
				})
			)
		);
	}

	getUnconfiguredRequiredSettings$(): Observable<IPluginSetting[]> {
		return this.selectAll().pipe(
			map((settings) =>
				settings.filter(
					(setting) =>
						setting.isRequired &&
						(setting.value === null || setting.value === undefined || setting.value === '')
				)
			)
		);
	}

	getValidationErrorsForSetting$(key: string): Observable<string[]> {
		return this.validationErrors$.pipe(map((errors) => errors[key] || []));
	}

	hasValidationErrorsForSetting$(key: string): Observable<boolean> {
		return this.getValidationErrorsForSetting$(key).pipe(map((errors) => errors.length > 0));
	}

	// Grouped settings selectors
	getSettingsGroup$(groupCategory: string): Observable<IPluginSettingGroup | undefined> {
		return this.settingsGroups$.pipe(map((groups) => groups.find((g) => g.category === groupCategory)));
	}

	getSettingsGroupsByCategory$(category: string): Observable<IPluginSettingGroup[]> {
		return this.settingsGroups$.pipe(
			map((groups) => groups.filter((g) => g.settings.some((s) => (s.category || 'general') === category)))
		);
	}

	// UI state helpers
	isPluginSelected$(pluginId: string): Observable<boolean> {
		return this.selectedPluginId$.pipe(map((selectedId) => selectedId === pluginId));
	}

	isCategorySelected$(category: string): Observable<boolean> {
		return this.selectedCategory$.pipe(map((selectedCategory) => selectedCategory === category));
	}

	// Loading state helpers
	isLoadingSettings$(): Observable<boolean> {
		return this.isLoading$;
	}

	isSavingSettings$(): Observable<boolean> {
		return this.isSaving$;
	}

	isValidatingSettings$(): Observable<boolean> {
		return this.isValidating$;
	}

	// Combined loading states
	isProcessing$(): Observable<boolean> {
		return combineLatest([this.isLoading$, this.isSaving$, this.isValidating$]).pipe(
			map(([loading, saving, validating]) => loading || saving || validating)
		);
	}

	// Error helpers
	hasError$(): Observable<boolean> {
		return this.errorMessage$.pipe(map((error) => !!error));
	}

	getErrorMessage$(): Observable<string | null> {
		return this.errorMessage$;
	}

	// Summary information
	getSettingsSummary$(): Observable<{
		total: number;
		configured: number;
		required: number;
		withErrors: number;
		categories: string[];
		hasUnsavedChanges: boolean;
	}> {
		return combineLatest([
			this.settingsStatistics$,
			this.validationErrorsCount$,
			this.categories$,
			this.hasUnsavedChanges$
		]).pipe(
			map(([stats, errorCount, categories, hasUnsaved]) => ({
				total: stats.total,
				configured: stats.configured,
				required: stats.required,
				withErrors: errorCount,
				categories,
				hasUnsavedChanges: hasUnsaved
			}))
		);
	}

	// Edit mode helpers
	isSettingBeingEdited$(settingKey: string): Observable<boolean> {
		return this.editingSettings$.pipe(map((editingSettings) => editingSettings.has(settingKey)));
	}

	isSettingBeingSaved$(settingKey: string): Observable<boolean> {
		return this.savingSettings$.pipe(map((savingSettings) => savingSettings.has(settingKey)));
	}

	getEditFormValue$(settingKey: string): Observable<any | undefined> {
		return this.editForms$.pipe(map((editForms) => editForms[settingKey]?.value));
	}

	getEditFormData$(settingKey: string): Observable<{ value: any; originalValue: any; isDirty: boolean } | undefined> {
		return this.editForms$.pipe(map((editForms) => editForms[settingKey]));
	}

	hasAnyEditingSettings$(): Observable<boolean> {
		return this.editingSettings$.pipe(map((editingSettings) => editingSettings.size > 0));
	}

	getEditingSettingsCount$(): Observable<number> {
		return this.editingSettings$.pipe(map((editingSettings) => editingSettings.size));
	}
}
