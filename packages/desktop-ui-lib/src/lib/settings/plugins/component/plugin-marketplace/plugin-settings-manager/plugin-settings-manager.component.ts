import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { IPlugin } from '@gauzy/contracts';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { UntilDestroy } from '@ngneat/until-destroy';
import { BehaviorSubject } from 'rxjs';

// Define setting data types locally
enum PluginSettingDataType {
	STRING = 'string',
	NUMBER = 'number',
	BOOLEAN = 'boolean',
	JSON = 'json',
	PASSWORD = 'password',
	EMAIL = 'email',
	URL = 'url',
	FILE = 'file',
	SELECT = 'select',
	MULTISELECT = 'multiselect',
	TEXT = 'text',
	DATE = 'date',
	TIME = 'time',
	DATETIME = 'datetime',
	COLOR = 'color',
	SLIDER = 'slider'
}

interface IPluginSetting {
	id?: string;
	key: string;
	value: any;
	dataType: PluginSettingDataType;
	isRequired: boolean;
	isEncrypted: boolean;
	description?: string;
	order?: number;
	validationRules?: any;
	defaultValue?: any;
	options?: any[]; // For select/multiselect
	min?: number; // For number/slider
	max?: number; // For number/slider
	step?: number; // For number/slider
	category?: string;
	groupName?: string;
	isVisible?: boolean;
	isDirty?: boolean;
}

@UntilDestroy()
@Component({
	selector: 'lib-plugin-settings-manager',
	templateUrl: './plugin-settings-manager.component.html',
	styleUrls: ['./plugin-settings-manager.component.scss'],
	standalone: false
})
export class PluginSettingsManagerComponent implements OnInit, OnDestroy {
	@Input() plugin: IPlugin;
	@Input() settings: IPluginSetting[] = [];
	@Input() isTenantSpecific: boolean = false;
	@Input() canEdit: boolean = true;

	public settingsForm: FormGroup;
	public isLoading$ = new BehaviorSubject<boolean>(false);
	public isSaving$ = new BehaviorSubject<boolean>(false);
	public groupedSettings: { [key: string]: IPluginSetting[] } = {};
	public searchTerm$ = new BehaviorSubject<string>('');
	public showAdvanced$ = new BehaviorSubject<boolean>(false);
	public showEncrypted$ = new BehaviorSubject<boolean>(false);

	// Enum references for template
	public PluginSettingDataType = PluginSettingDataType;

	constructor(
		private readonly formBuilder: FormBuilder,
		private readonly dialogService: NbDialogService,
		private readonly dialogRef: NbDialogRef<PluginSettingsManagerComponent>
	) {
		this.initializeForm();
	}

	ngOnInit(): void {
		this.loadSettings();
		this.groupSettings();
		this.buildDynamicForm();
	}

	ngOnDestroy(): void {
		// Cleanup handled by @UntilDestroy
	}

	private initializeForm(): void {
		this.settingsForm = this.formBuilder.group({
			settings: this.formBuilder.array([])
		});
	}

	private loadSettings(): void {
		// In a real implementation, this would load from the API
		if (!this.settings.length) {
			this.settings = this.getDefaultSettings();
		}
	}

	private getDefaultSettings(): IPluginSetting[] {
		return [
			{
				key: 'api_key',
				value: '',
				dataType: PluginSettingDataType.PASSWORD,
				isRequired: true,
				isEncrypted: true,
				description: 'API key for external service integration',
				groupName: 'Authentication',
				category: 'security'
			},
			{
				key: 'api_endpoint',
				value: 'https://api.example.com',
				dataType: PluginSettingDataType.URL,
				isRequired: true,
				isEncrypted: false,
				description: 'Base URL for API endpoints',
				groupName: 'Authentication',
				category: 'connection'
			},
			{
				key: 'max_retries',
				value: 3,
				dataType: PluginSettingDataType.NUMBER,
				isRequired: false,
				isEncrypted: false,
				description: 'Maximum number of retry attempts',
				min: 1,
				max: 10,
				step: 1,
				groupName: 'Behavior',
				category: 'performance'
			},
			{
				key: 'enable_logging',
				value: true,
				dataType: PluginSettingDataType.BOOLEAN,
				isRequired: false,
				isEncrypted: false,
				description: 'Enable detailed logging for debugging',
				groupName: 'Debugging',
				category: 'general'
			},
			{
				key: 'log_level',
				value: 'info',
				dataType: PluginSettingDataType.SELECT,
				isRequired: false,
				isEncrypted: false,
				description: 'Logging level',
				options: [
					{ value: 'error', label: 'Error' },
					{ value: 'warn', label: 'Warning' },
					{ value: 'info', label: 'Info' },
					{ value: 'debug', label: 'Debug' }
				],
				groupName: 'Debugging',
				category: 'general'
			},
			{
				key: 'notification_email',
				value: '',
				dataType: PluginSettingDataType.EMAIL,
				isRequired: false,
				isEncrypted: false,
				description: 'Email address for notifications',
				groupName: 'Notifications',
				category: 'general'
			},
			{
				key: 'sync_interval',
				value: 300,
				dataType: PluginSettingDataType.SLIDER,
				isRequired: false,
				isEncrypted: false,
				description: 'Synchronization interval in seconds',
				min: 60,
				max: 3600,
				step: 60,
				groupName: 'Behavior',
				category: 'performance'
			},
			{
				key: 'enabled_features',
				value: ['feature1', 'feature2'],
				dataType: PluginSettingDataType.MULTISELECT,
				isRequired: false,
				isEncrypted: false,
				description: 'Select which features to enable',
				options: [
					{ value: 'feature1', label: 'Feature 1' },
					{ value: 'feature2', label: 'Feature 2' },
					{ value: 'feature3', label: 'Feature 3' },
					{ value: 'feature4', label: 'Feature 4' }
				],
				groupName: 'Features',
				category: 'general'
			},
			{
				key: 'theme_color',
				value: '#407BFF',
				dataType: PluginSettingDataType.COLOR,
				isRequired: false,
				isEncrypted: false,
				description: 'Primary theme color',
				groupName: 'Appearance',
				category: 'ui'
			},
			{
				key: 'custom_config',
				value: { timeout: 5000, retries: 3 },
				dataType: PluginSettingDataType.JSON,
				isRequired: false,
				isEncrypted: false,
				description: 'Advanced configuration (JSON format)',
				groupName: 'Advanced',
				category: 'advanced'
			}
		];
	}

	private groupSettings(): void {
		this.groupedSettings = this.settings.reduce((groups, setting) => {
			const group = setting.groupName || 'General';
			if (!groups[group]) {
				groups[group] = [];
			}
			groups[group].push(setting);
			return groups;
		}, {} as { [key: string]: IPluginSetting[] });

		// Sort settings within each group by order
		Object.keys(this.groupedSettings).forEach((group) => {
			this.groupedSettings[group].sort((a, b) => (a.order || 999) - (b.order || 999));
		});
	}

	private buildDynamicForm(): void {
		const settingsArray = this.settingsForm.get('settings') as FormArray;
		settingsArray.clear();

		this.settings.forEach((setting) => {
			const control = this.createFormControl(setting);
			settingsArray.push(control);
		});
	}

	private createFormControl(setting: IPluginSetting): FormGroup {
		const validators = this.getValidators(setting);

		return this.formBuilder.group({
			key: [setting.key],
			value: [setting.value, validators],
			dataType: [setting.dataType],
			isRequired: [setting.isRequired],
			isEncrypted: [setting.isEncrypted],
			description: [setting.description],
			groupName: [setting.groupName],
			category: [setting.category]
		});
	}

	private getValidators(setting: IPluginSetting): ValidatorFn[] {
		const validators: ValidatorFn[] = [];

		if (setting.isRequired) {
			validators.push(Validators.required);
		}

		switch (setting.dataType) {
			case PluginSettingDataType.EMAIL:
				validators.push(Validators.email);
				break;
			case PluginSettingDataType.URL:
				validators.push(this.urlValidator());
				break;
			case PluginSettingDataType.NUMBER:
			case PluginSettingDataType.SLIDER:
				if (setting.min !== undefined) {
					validators.push(Validators.min(setting.min));
				}
				if (setting.max !== undefined) {
					validators.push(Validators.max(setting.max));
				}
				break;
			case PluginSettingDataType.JSON:
				validators.push(this.jsonValidator());
				break;
		}

		// Add custom validation rules if provided
		if (setting.validationRules) {
			// Parse and apply custom validation rules
			// This would be implemented based on your validation rule format
		}

		return validators;
	}

	private urlValidator(): ValidatorFn {
		return (control: AbstractControl): { [key: string]: any } | null => {
			if (!control.value) return null;
			try {
				new URL(control.value);
				return null;
			} catch {
				return { invalidUrl: true };
			}
		};
	}

	private jsonValidator(): ValidatorFn {
		return (control: AbstractControl): { [key: string]: any } | null => {
			if (!control.value) return null;
			try {
				if (typeof control.value === 'string') {
					JSON.parse(control.value);
				}
				return null;
			} catch {
				return { invalidJson: true };
			}
		};
	}

	public getSettingsByGroup(groupName: string): IPluginSetting[] {
		return this.groupedSettings[groupName] || [];
	}

	public getGroupNames(): string[] {
		return Object.keys(this.groupedSettings).sort();
	}

	public getSettingFormGroup(index: number): FormGroup {
		const settingsArray = this.settingsForm.get('settings') as FormArray;
		return settingsArray.at(index) as FormGroup;
	}

	public getSettingIndex(setting: IPluginSetting): number {
		return this.settings.findIndex((s) => s.key === setting.key);
	}

	public isSettingVisible(setting: IPluginSetting): boolean {
		const searchTerm = this.searchTerm$.value.toLowerCase();
		const showAdvanced = this.showAdvanced$.value;
		const showEncrypted = this.showEncrypted$.value;

		// Search filter
		if (
			searchTerm &&
			!setting.key.toLowerCase().includes(searchTerm) &&
			!setting.description?.toLowerCase().includes(searchTerm)
		) {
			return false;
		}

		// Advanced filter
		if (!showAdvanced && setting.category === 'advanced') {
			return false;
		}

		// Encrypted filter
		if (!showEncrypted && setting.isEncrypted) {
			return false;
		}

		return setting.isVisible !== false;
	}

	public hasVisibleSettingsInGroup(groupName: string): boolean {
		return this.getSettingsByGroup(groupName).some((setting) => this.isSettingVisible(setting));
	}

	public resetSetting(setting: IPluginSetting): void {
		const index = this.getSettingIndex(setting);
		if (index >= 0) {
			const formGroup = this.getSettingFormGroup(index);
			formGroup.get('value')?.setValue(setting.defaultValue);
			formGroup.markAsDirty();
		}
	}

	public resetAllSettings(): void {
		this.dialogService
			.open(this.getResetConfirmationDialog(), {
				context: {
					title: 'Reset All Settings',
					message:
						'Are you sure you want to reset all settings to their default values? This action cannot be undone.',
					confirmText: 'Reset All',
					cancelText: 'Cancel'
				}
			})
			.onClose.subscribe((confirmed: boolean) => {
				if (confirmed) {
					this.settings.forEach((setting) => {
						this.resetSetting(setting);
					});
				}
			});
	}

	public saveSettings(): void {
		if (!this.settingsForm.valid) {
			this.markFormGroupTouched();
			return;
		}

		this.isSaving$.next(true);

		const formValues = this.settingsForm.value.settings;
		const updatedSettings = formValues.map((formSetting: any, index: number) => ({
			...this.settings[index],
			value: formSetting.value
		}));

		// Simulate API call
		setTimeout(() => {
			this.isSaving$.next(false);
			this.dialogRef.close({
				success: true,
				settings: updatedSettings
			});
		}, 1500);
	}

	public testConnection(): void {
		// Test connection with current settings
		this.isLoading$.next(true);

		// Simulate API test
		setTimeout(() => {
			this.isLoading$.next(false);
			// Show success/error message
		}, 2000);
	}

	public exportSettings(): void {
		const settingsData = {
			plugin: this.plugin.name,
			version: this.plugin.version?.number || '1.0.0',
			timestamp: new Date().toISOString(),
			settings: this.settings.reduce((obj, setting) => {
				if (!setting.isEncrypted) {
					obj[setting.key] = setting.value;
				}
				return obj;
			}, {} as any)
		};

		const blob = new Blob([JSON.stringify(settingsData, null, 2)], {
			type: 'application/json'
		});

		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `${this.plugin.name}-settings.json`;
		link.click();
		URL.revokeObjectURL(url);
	}

	public importSettings(event: Event): void {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];

		if (!file) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const importedData = JSON.parse(e.target?.result as string);
				this.applyImportedSettings(importedData.settings);
			} catch (error) {
				console.error('Invalid settings file:', error);
				// Show error message
			}
		};
		reader.readAsText(file);
	}

	private applyImportedSettings(importedSettings: any): void {
		Object.keys(importedSettings).forEach((key) => {
			const setting = this.settings.find((s) => s.key === key);
			if (setting && !setting.isEncrypted) {
				const index = this.getSettingIndex(setting);
				if (index >= 0) {
					const formGroup = this.getSettingFormGroup(index);
					formGroup.get('value')?.setValue(importedSettings[key]);
					formGroup.markAsDirty();
				}
			}
		});
	}

	private markFormGroupTouched(): void {
		const settingsArray = this.settingsForm.get('settings') as FormArray;
		settingsArray.controls.forEach((control) => {
			control.markAllAsTouched();
		});
	}

	private getResetConfirmationDialog(): any {
		// Return a confirmation dialog component reference
		// This would be implemented based on your dialog system
		return null; // Placeholder
	}

	public close(): void {
		if (this.settingsForm.dirty) {
			this.dialogService
				.open(this.getUnsavedChangesDialog(), {
					context: {
						title: 'Unsaved Changes',
						message: 'You have unsaved changes. Are you sure you want to close without saving?',
						confirmText: 'Close Without Saving',
						cancelText: 'Cancel'
					}
				})
				.onClose.subscribe((confirmed: boolean) => {
					if (confirmed) {
						this.dialogRef.close();
					}
				});
		} else {
			this.dialogRef.close();
		}
	}

	private getUnsavedChangesDialog(): any {
		// Return a confirmation dialog component reference
		// This would be implemented based on your dialog system
		return null; // Placeholder
	}

	public getGroupIcon(groupName: string): string {
		switch (groupName.toLowerCase()) {
			case 'authentication':
				return 'lock-outline';
			case 'behavior':
				return 'settings-outline';
			case 'debugging':
				return 'bug-outline';
			case 'notifications':
				return 'bell-outline';
			case 'features':
				return 'grid-outline';
			case 'appearance':
				return 'color-palette-outline';
			case 'advanced':
				return 'code-outline';
			default:
				return 'folder-outline';
		}
	}

	public resetGroupSettings(groupName: string): void {
		const groupSettings = this.getSettingsByGroup(groupName);
		groupSettings.forEach((setting) => {
			this.resetSetting(setting);
		});
	}

	public formatJson(setting: IPluginSetting): void {
		const index = this.getSettingIndex(setting);
		if (index >= 0) {
			const formGroup = this.getSettingFormGroup(index);
			const value = formGroup.get('value')?.value;

			try {
				const parsed = typeof value === 'string' ? JSON.parse(value) : value;
				const formatted = JSON.stringify(parsed, null, 2);
				formGroup.get('value')?.setValue(formatted);
				formGroup.markAsDirty();
			} catch (error) {
				console.error('Invalid JSON:', error);
			}
		}
	}

	public validateJson(setting: IPluginSetting): void {
		const index = this.getSettingIndex(setting);
		if (index >= 0) {
			const formGroup = this.getSettingFormGroup(index);
			const value = formGroup.get('value')?.value;

			try {
				if (typeof value === 'string') {
					JSON.parse(value);
				}
				// Show success message or visual indicator
				console.log('JSON is valid');
			} catch (error) {
				// Show error message
				console.error('Invalid JSON:', error);
			}
		}
	}
}
