import { createAction, props } from '@ngneat/effects';
import { IPluginSetting, IPluginSettingGroup, PluginSettingScope } from '../../../../services/plugin-settings.service';
import {
	BulkUpdatePluginSettingsRequest,
	CreatePluginSettingRequest,
	LoadPluginSettingsRequest,
	ResetPluginSettingsRequest,
	UpdatePluginSettingRequest,
	ValidatePluginSettingsRequest
} from '../stores/plugin-settings.store';

export const PluginSettingsActions = {
	// Load plugin settings
	loadSettings: createAction('[Plugin Settings] Load Settings', props<LoadPluginSettingsRequest>()),
	loadSettingsSuccess: createAction(
		'[Plugin Settings] Load Settings Success',
		props<{ settings: IPluginSetting[] }>()
	),
	loadSettingsFailure: createAction('[Plugin Settings] Load Settings Failure', props<{ error: string }>()),

	// Load grouped settings
	loadGroupedSettings: createAction('[Plugin Settings] Load Grouped Settings', props<LoadPluginSettingsRequest>()),
	loadGroupedSettingsSuccess: createAction(
		'[Plugin Settings] Load Grouped Settings Success',
		props<{ settingsGroups: IPluginSettingGroup[] }>()
	),
	loadGroupedSettingsFailure: createAction(
		'[Plugin Settings] Load Grouped Settings Failure',
		props<{ error: string }>()
	),

	// Create setting
	createSetting: createAction('[Plugin Settings] Create Setting', props<CreatePluginSettingRequest>()),
	createSettingSuccess: createAction(
		'[Plugin Settings] Create Setting Success',
		props<{ setting: IPluginSetting }>()
	),
	createSettingFailure: createAction('[Plugin Settings] Create Setting Failure', props<{ error: string }>()),

	// Update setting
	updateSetting: createAction('[Plugin Settings] Update Setting', props<UpdatePluginSettingRequest>()),
	updateSettingSuccess: createAction(
		'[Plugin Settings] Update Setting Success',
		props<{ setting: IPluginSetting; validation?: { valid: boolean; errors?: string[] } }>()
	),
	updateSettingFailure: createAction('[Plugin Settings] Update Setting Failure', props<{ error: string }>()),

	// Bulk update settings
	bulkUpdateSettings: createAction(
		'[Plugin Settings] Bulk Update Settings',
		props<BulkUpdatePluginSettingsRequest>()
	),
	bulkUpdateSettingsSuccess: createAction(
		'[Plugin Settings] Bulk Update Settings Success',
		props<{ settings: IPluginSetting[] }>()
	),
	bulkUpdateSettingsFailure: createAction(
		'[Plugin Settings] Bulk Update Settings Failure',
		props<{ error: string }>()
	),

	// Delete setting
	deleteSetting: createAction('[Plugin Settings] Delete Setting', props<{ settingId: string }>()),
	deleteSettingSuccess: createAction('[Plugin Settings] Delete Setting Success', props<{ settingId: string }>()),
	deleteSettingFailure: createAction('[Plugin Settings] Delete Setting Failure', props<{ error: string }>()),

	// Validate settings
	validateSettings: createAction('[Plugin Settings] Validate Settings', props<ValidatePluginSettingsRequest>()),
	validateSettingsSuccess: createAction(
		'[Plugin Settings] Validate Settings Success',
		props<{ valid: boolean; errors: Array<{ key: string; errors: string[] }> }>()
	),
	validateSettingsFailure: createAction('[Plugin Settings] Validate Settings Failure', props<{ error: string }>()),

	// Validate single setting
	validateSetting: createAction(
		'[Plugin Settings] Validate Setting',
		props<{ pluginId: string; key: string; value: any; template?: any }>()
	),
	validateSettingSuccess: createAction(
		'[Plugin Settings] Validate Setting Success',
		props<{ key: string; valid: boolean; errors: string[] }>()
	),
	validateSettingFailure: createAction(
		'[Plugin Settings] Validate Setting Failure',
		props<{ key: string; error: string }>()
	),

	// Reset settings to default
	resetSettings: createAction('[Plugin Settings] Reset Settings', props<ResetPluginSettingsRequest>()),
	resetSettingsSuccess: createAction(
		'[Plugin Settings] Reset Settings Success',
		props<{ settings: IPluginSetting[] }>()
	),
	resetSettingsFailure: createAction('[Plugin Settings] Reset Settings Failure', props<{ error: string }>()),

	// Export/Import settings
	exportSettings: createAction(
		'[Plugin Settings] Export Settings',
		props<{
			pluginId: string;
			scope?: PluginSettingScope;
			tenantId?: string;
			organizationId?: string;
			userId?: string;
		}>()
	),
	exportSettingsSuccess: createAction('[Plugin Settings] Export Settings Success', props<{ blob: Blob }>()),
	exportSettingsFailure: createAction('[Plugin Settings] Export Settings Failure', props<{ error: string }>()),

	importSettings: createAction(
		'[Plugin Settings] Import Settings',
		props<{
			pluginId: string;
			file: File;
			scope?: PluginSettingScope;
			tenantId?: string;
			organizationId?: string;
			userId?: string;
		}>()
	),
	importSettingsSuccess: createAction(
		'[Plugin Settings] Import Settings Success',
		props<{ imported: number; skipped: number; errors: string[] }>()
	),
	importSettingsFailure: createAction('[Plugin Settings] Import Settings Failure', props<{ error: string }>()),

	// UI state management
	selectPlugin: createAction(
		'[Plugin Settings] Select Plugin',
		props<{ pluginId: string; scope?: PluginSettingScope }>()
	),
	clearSelection: createAction('[Plugin Settings] Clear Selection'),
	setSearchTerm: createAction('[Plugin Settings] Set Search Term', props<{ searchTerm: string }>()),
	setSelectedCategory: createAction('[Plugin Settings] Set Selected Category', props<{ selectedCategory: string }>()),
	toggleAdvancedSettings: createAction('[Plugin Settings] Toggle Advanced Settings'),
	setAdvancedSettings: createAction(
		'[Plugin Settings] Set Advanced Settings',
		props<{ showAdvancedSettings: boolean }>()
	),
	markUnsavedChanges: createAction('[Plugin Settings] Mark Unsaved Changes'),
	clearUnsavedChanges: createAction('[Plugin Settings] Clear Unsaved Changes'),
	clearSettings: createAction('[Plugin Settings] Clear Settings'),
	clearError: createAction('[Plugin Settings] Clear Error'),
	clearValidationErrors: createAction('[Plugin Settings] Clear Validation Errors'),
	setValidationError: createAction(
		'[Plugin Settings] Set Validation Error',
		props<{ settingKey: string; errors: string[] }>()
	)
};
