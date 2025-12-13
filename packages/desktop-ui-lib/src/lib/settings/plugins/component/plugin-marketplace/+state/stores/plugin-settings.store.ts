import { Injectable } from '@angular/core';
import { EntityState, EntityStore, StoreConfig } from '@datorama/akita';
import {
	IPluginSetting,
	IPluginSettingCreateInput,
	IPluginSettingGroup,
	PluginSettingScope
} from '../../../../services/plugin-settings.service';

export interface PluginSettingsState extends EntityState<IPluginSetting> {
	settingsGroups: IPluginSettingGroup[];
	loading: boolean;
	saving: boolean;
	validating: boolean;
	errorMessage: string | null;
	validationErrors: Record<string, string[]>;
	ui: {
		selectedPluginId: string | null;
		selectedScope: PluginSettingScope | null;
		hasUnsavedChanges: boolean;
		searchTerm: string;
		selectedCategory: string;
		showAdvancedSettings: boolean;
	};
}

export interface LoadPluginSettingsRequest {
	pluginId: string;
	query?: {
		category?: string;
		key?: string;
		pluginTenantId?: string;
	};
}

export interface CreatePluginSettingRequest {
	pluginId: string;
	setting: IPluginSettingCreateInput;
}

export interface UpdatePluginSettingRequest {
	pluginId: string;
	settingId: string;
	updateData: { value: any; [key: string]: any };
}

export interface BulkUpdatePluginSettingsRequest {
	pluginId: string;
	updates: {
		settings: Array<{
			key: string;
			value: any;
			[key: string]: any;
		}>;
		pluginTenantId?: string;
	};
}

export interface ValidatePluginSettingsRequest {
	pluginId: string;
	settings: Record<string, any>;
}

export interface ResetPluginSettingsRequest {
	pluginId: string;
	scope?: PluginSettingScope;
	tenantId?: string;
	organizationId?: string;
	userId?: string;
}

@Injectable()
@StoreConfig({ name: 'pluginSettings' })
export class PluginSettingsStore extends EntityStore<PluginSettingsState> {
	constructor() {
		super({
			loading: false,
			saving: false,
			validating: false,
			errorMessage: null,
			validationErrors: {},
			settingsGroups: [],
			ui: {
				selectedPluginId: null,
				selectedScope: null,
				hasUnsavedChanges: false,
				searchTerm: '',
				selectedCategory: 'all',
				showAdvancedSettings: false
			}
		});
	}

	setLoading(loading: boolean): void {
		this.update({ loading });
	}

	setSaving(saving: boolean): void {
		this.update({ saving });
	}

	setValidating(validating: boolean): void {
		this.update({ validating });
	}

	setErrorMessage(errorMessage: string | null): void {
		this.update({ errorMessage });
	}

	setSettings(settings: IPluginSetting[]): void {
		this.set(settings);
		this.update({
			errorMessage: null,
			ui: {
				...this.getValue().ui,
				hasUnsavedChanges: false
			}
		});
	}

	setSettingsGroups(settingsGroups: IPluginSettingGroup[]): void {
		this.update({
			settingsGroups,
			errorMessage: null
		});
	}

	updateSetting(settingId: string, updates: Partial<IPluginSetting>): void {
		this.update(settingId, updates);
		this.update({
			ui: {
				...this.getValue().ui,
				hasUnsavedChanges: true
			}
		});
	}

	addSetting(newSetting: IPluginSetting): void {
		this.add(newSetting);
		this.update({ errorMessage: null });
	}

	removeSetting(settingId: string): void {
		this.remove(settingId);
	}

	setValidationErrors(validationErrors: Record<string, string[]>): void {
		this.update({ validationErrors });
	}

	clearValidationErrors(): void {
		this.update({ validationErrors: {} });
	}

	setValidationError(settingKey: string, errors: string[]): void {
		const validationErrors = { ...this.getValue().validationErrors };
		if (errors.length > 0) {
			validationErrors[settingKey] = errors;
		} else {
			delete validationErrors[settingKey];
		}
		this.update({ validationErrors });
	}

	selectPlugin(pluginId: string, scope?: PluginSettingScope): void {
		this.update({
			ui: {
				...this.getValue().ui,
				selectedPluginId: pluginId,
				selectedScope: scope || null,
				hasUnsavedChanges: false
			}
		});
	}

	clearSelection(): void {
		this.update({
			ui: {
				...this.getValue().ui,
				selectedPluginId: null,
				selectedScope: null,
				hasUnsavedChanges: false
			}
		});
	}

	setSearchTerm(searchTerm: string): void {
		this.update({
			ui: {
				...this.getValue().ui,
				searchTerm
			}
		});
	}

	setSelectedCategory(selectedCategory: string): void {
		this.update({
			ui: {
				...this.getValue().ui,
				selectedCategory
			}
		});
	}

	toggleAdvancedSettings(): void {
		this.update({
			ui: {
				...this.getValue().ui,
				showAdvancedSettings: !this.getValue().ui.showAdvancedSettings
			}
		});
	}

	setAdvancedSettings(showAdvancedSettings: boolean): void {
		this.update({
			ui: {
				...this.getValue().ui,
				showAdvancedSettings
			}
		});
	}

	markUnsavedChanges(): void {
		this.update({
			ui: {
				...this.getValue().ui,
				hasUnsavedChanges: true
			}
		});
	}

	clearUnsavedChanges(): void {
		this.update({
			ui: {
				...this.getValue().ui,
				hasUnsavedChanges: false
			}
		});
	}

	clearSettings(): void {
		this.remove();
		this.update({
			settingsGroups: [],
			validationErrors: {},
			ui: {
				...this.getValue().ui,
				hasUnsavedChanges: false
			}
		});
	}

	clearError(): void {
		this.update({ errorMessage: null });
	}

	reset(): void {
		this.remove();
		this.update({
			loading: false,
			saving: false,
			validating: false,
			errorMessage: null,
			validationErrors: {},
			settingsGroups: [],
			ui: {
				selectedPluginId: null,
				selectedScope: null,
				hasUnsavedChanges: false,
				searchTerm: '',
				selectedCategory: 'all',
				showAdvancedSettings: false
			}
		});
	}
}
