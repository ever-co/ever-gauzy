import {
	AfterViewInit,
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	inject,
	Inject,
	OnDestroy,
	OnInit,
	ViewChild
} from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { IPlugin } from '@gauzy/contracts';
import { NB_DIALOG_CONFIG, NbDialogRef } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { debounceTime, distinctUntilChanged, filter, map, Observable, startWith, switchMap, take, tap } from 'rxjs';
import { PluginCategoryQuery, PluginSettingsActions, PluginSettingsQuery } from '../+state';
import {
	IPluginSetting,
	IPluginSettingGroup,
	PluginSettingScope,
	PluginSettingsService,
	PluginSettingType
} from '../../../services/plugin-settings.service';
import { CategorySelectorComponent } from '../plugin-marketplace-item/category-selector/category-selector.component';

export interface PluginSettingsDialogData {
	plugin: IPlugin;
	installationId?: string;
	scope?: PluginSettingScope;
	organizationId?: string;
	tenantId?: string;
	userId?: string;
}

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'lib-plugin-settings-management',
	templateUrl: './plugin-settings-management.component.html',
	styleUrls: ['./plugin-settings-management.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false
})
export class PluginSettingsManagementComponent implements OnInit, OnDestroy, AfterViewInit {
	public plugin: IPlugin;
	public settingsForm: FormGroup;
	public searchForm: FormGroup;
	public installationId?: string;
	public scope: string;
	public organizationId?: string;
	public tenantId?: string;

	// Loading state
	public submitting = false;
	public Array = Array;

	// Setting types enum for template
	public readonly PluginSettingType = PluginSettingType;

	@ViewChild(CategorySelectorComponent) categorySelector: CategorySelectorComponent;

	// Use inject for dependencies following Angular 20 best practices
	private readonly formBuilder = inject(FormBuilder);
	private readonly pluginSettingsService = inject(PluginSettingsService);
	private readonly query = inject(PluginSettingsQuery);
	private readonly actions = inject(Actions);
	private readonly categoryQuery = inject(PluginCategoryQuery);
	private readonly cdr = inject(ChangeDetectorRef);

	// State observables (defined after inject to ensure query is available)
	public readonly settingsGroups$ = this.query.settingsGroups$;
	public readonly filteredGroups$ = this.query.filteredGroups$;
	public readonly categories$ = this.query.categories$;
	public readonly loading$ = this.query.isLoading$;
	public readonly saving$ = this.query.isSaving$;
	public readonly validating$ = this.query.isValidating$;
	public readonly validationErrors$ = this.query.validationErrors$;
	public readonly hasUnsavedChanges$ = this.query.hasUnsavedChanges$;
	public readonly isFormValid$ = this.query.isFormValid$;

	// Edit mode state from Akita
	public readonly editingSettings$ = this.query.editingSettings$;
	public readonly savingSettings$ = this.query.savingSettings$;
	public readonly editForms$ = this.query.editForms$;
	public readonly editingSettingsCount$ = this.query.getEditingSettingsCount$();

	constructor(
		@Inject(NB_DIALOG_CONFIG) public data: PluginSettingsDialogData,
		private readonly dialogRef: NbDialogRef<PluginSettingsManagementComponent>
	) {
		this.plugin = this.data.plugin;
		this.initializeForms();
	}

	ngOnInit(): void {
		// Select the plugin and load settings
		this.actions.dispatch(
			PluginSettingsActions.selectPlugin({
				pluginId: this.plugin.id,
				scope: this.data.scope || PluginSettingScope.GLOBAL
			})
		);

		this.loadSettings();
		this.setupSearch();
		this.setupValidation();
		this.subscribeToSettingsChanges();
	}

	ngAfterViewInit(): void {
		this.syncCategoryWithForm();
	}

	private syncCategoryWithForm(): void {
		this.categoryQuery.selectedCategory$
			.pipe(
				filter(Boolean),
				map((category) => category.id),
				filter((categoryId) => categoryId !== this.categoryId.value),
				distinctUntilChanged(),
				tap((categoryId) => this.categoryId.setValue(categoryId, { emitEvent: false })),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public get categoryId(): FormControl<string> {
		return this.searchForm.get('categoryId') as FormControl<string>;
	}

	ngOnDestroy(): void {
		this.actions.dispatch(PluginSettingsActions.clearEditState());
		this.actions.dispatch(PluginSettingsActions.clearSelection());
	}

	private initializeForms(): void {
		this.settingsForm = this.formBuilder.group({});
		this.searchForm = this.formBuilder.group({
			searchTerm: [''],
			categoryId: [null]
		});
	}

	private loadSettings(): void {
		const scope = this.data.scope || PluginSettingScope.GLOBAL;
		const query = {
			pluginTenantId: this.data.tenantId
		};

		this.actions.dispatch(
			PluginSettingsActions.loadGroupedSettings({
				pluginId: this.plugin.id,
				query
			})
		);
	}

	private subscribeToSettingsChanges(): void {
		// Rebuild form when settings are loaded
		this.settingsGroups$
			.pipe(
				filter((groups) => groups.length > 0),
				tap((groups) => this.buildSettingsForm(groups)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private buildSettingsForm(groups: IPluginSettingGroup[]): void {
		const formControls: Record<string, any> = {};

		groups.forEach((group) => {
			group.settings.forEach((setting) => {
				const validators = this.buildValidators(setting);
				formControls[setting.key] = [setting.value, validators];
			});
		});

		this.settingsForm = this.formBuilder.group(formControls);
	}

	private buildValidators(setting: IPluginSetting): ValidatorFn[] {
		const validators: ValidatorFn[] = [];

		if (setting.isRequired) {
			validators.push(Validators.required);
		}

		if (setting.validation) {
			const validation = setting.validation;

			if (validation.minLength) {
				validators.push(Validators.minLength(validation.minLength));
			}

			if (validation.maxLength) {
				validators.push(Validators.maxLength(validation.maxLength));
			}

			if (validation.min !== undefined) {
				validators.push(Validators.min(validation.min));
			}

			if (validation.max !== undefined) {
				validators.push(Validators.max(validation.max));
			}

			if (validation.pattern) {
				validators.push(Validators.pattern(validation.pattern));
			}
		}

		// Type-specific validators
		switch (setting.type) {
			case PluginSettingType.EMAIL:
				validators.push(Validators.email);
				break;
			case PluginSettingType.URL:
				validators.push(this.urlValidator);
				break;
		}

		return validators;
	}

	private urlValidator(control: any): { [key: string]: any } | null {
		try {
			if (control.value) {
				new URL(control.value);
			}
			return null;
		} catch {
			return { url: true };
		}
	}

	private setupSearch(): void {
		// Handle search term changes
		this.searchForm
			.get('searchTerm')
			?.valueChanges.pipe(
				startWith(''),
				debounceTime(300),
				distinctUntilChanged(),
				tap((term) => {
					this.actions.dispatch(PluginSettingsActions.setSearchTerm({ searchTerm: term || '' }));
				}),
				untilDestroyed(this)
			)
			.subscribe();

		// Handle category filter changes
		this.searchForm
			.get('categoryId')
			?.valueChanges.pipe(
				startWith('all'),
				distinctUntilChanged(),
				tap((category) => {
					this.actions.dispatch(
						PluginSettingsActions.setSelectedCategory({ selectedCategory: category || 'all' })
					);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private setupValidation(): void {
		// Watch for form value changes and validate
		this.settingsForm.valueChanges
			.pipe(
				debounceTime(500),
				tap(() => this.actions.dispatch(PluginSettingsActions.markUnsavedChanges())),
				switchMap((formValue) => {
					const settings = Object.entries(formValue).map(([key, value]) => ({ key, value }));
					this.actions.dispatch(
						PluginSettingsActions.validateSettings({
							pluginId: this.plugin.id,
							settings
						})
					);
					return [];
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private validateSettings(formValue: Record<string, any>): Observable<any> {
		const settings = Object.entries(formValue).map(([key, value]) => ({ key, value }));
		this.actions.dispatch(
			PluginSettingsActions.validateSettings({
				pluginId: this.plugin.id,
				settings
			})
		);
		return this.query.validationErrors$;
	}

	public onSaveSettings(): void {
		if (this.settingsForm.valid && !this.submitting) {
			this.submitting = true;
			const formValue = this.settingsForm.value;

			// Convert form values to bulk update format
			const settingsUpdates = Object.entries(formValue).map(([key, value]) => ({ key, value }));

			// If there are no settings to update, skip the request
			if (settingsUpdates.length === 0) {
				this.submitting = false;
				return;
			}
			const updates = {
				pluginId: this.plugin.id,
				settings: settingsUpdates,
				pluginTenantId: this.data.tenantId
			};

			this.actions.dispatch(
				PluginSettingsActions.bulkUpdateSettings({
					pluginId: this.plugin.id,
					updates
				})
			);

			// Subscribe to success/failure
			this.saving$
				.pipe(
					filter((saving) => !saving), // Wait for saving to complete
					tap(() => {
						this.submitting = false;
						this.dialogRef.close(true);
					}),
					untilDestroyed(this)
				)
				.subscribe();
		}
	}

	public onResetSettings(): void {
		// Note: You'll need to implement or import a proper confirm dialog
		if (
			confirm(
				'Are you sure you want to reset all settings to their default values? This action cannot be undone.'
			)
		) {
			this.actions.dispatch(
				PluginSettingsActions.resetSettings({
					pluginId: this.plugin.id,
					scope: this.data.scope || PluginSettingScope.GLOBAL,
					tenantId: this.data.tenantId,
					organizationId: this.data.organizationId,
					userId: this.data.userId
				})
			);
		}
	}

	public getSettingErrorMessage(settingKey: string): Observable<string> {
		return this.query.getValidationErrorsForSetting$(settingKey).pipe(map((errors) => errors.join(', ')));
	}

	public hasSettingError(settingKey: string): Observable<boolean> {
		return this.query.hasValidationErrorsForSetting$(settingKey);
	}

	public getSettingTypeIcon(type: PluginSettingType): string {
		return this.pluginSettingsService.getSettingTypeIcon(type);
	}

	public formatSettingType(type: PluginSettingType): string {
		return this.pluginSettingsService.formatSettingType(type);
	}

	public isSelectType(type: PluginSettingType): boolean {
		return [PluginSettingType.SELECT, PluginSettingType.RADIO].includes(type);
	}

	public isMultiSelectType(type: PluginSettingType): boolean {
		return [PluginSettingType.MULTI_SELECT, PluginSettingType.CHECKBOX].includes(type);
	}

	public isBooleanType(type: PluginSettingType): boolean {
		return type === PluginSettingType.BOOLEAN;
	}

	public isTextAreaType(type: PluginSettingType): boolean {
		return [PluginSettingType.TEXT, PluginSettingType.JSON].includes(type);
	}

	public isPasswordType(type: PluginSettingType): boolean {
		return type === PluginSettingType.PASSWORD;
	}

	public isNumberType(type: PluginSettingType): boolean {
		return [PluginSettingType.NUMBER, PluginSettingType.RANGE].includes(type);
	}

	public isDateType(type: PluginSettingType): boolean {
		return [PluginSettingType.DATE, PluginSettingType.TIME, PluginSettingType.DATETIME].includes(type);
	}

	public getInputType(type: PluginSettingType): string {
		switch (type) {
			case PluginSettingType.EMAIL:
				return 'email';
			case PluginSettingType.URL:
				return 'url';
			case PluginSettingType.PASSWORD:
				return 'password';
			case PluginSettingType.NUMBER:
				return 'number';
			case PluginSettingType.DATE:
				return 'date';
			case PluginSettingType.TIME:
				return 'time';
			case PluginSettingType.DATETIME:
				return 'datetime-local';
			case PluginSettingType.COLOR:
				return 'color';
			case PluginSettingType.RANGE:
				return 'range';
			default:
				return 'text';
		}
	}

	public onDeleteSetting(settingId: string, settingKey: string): void {
		if (confirm(`Are you sure you want to delete the setting "${settingKey}"? This action cannot be undone.`)) {
			this.actions.dispatch(
				PluginSettingsActions.deleteSetting({
					pluginId: this.plugin.id,
					settingId
				})
			);
		}
	}

	public onCreateSetting(): void {
		// Open a dialog or form to create a new setting
		// This would require a separate component for the creation form
		// For now, we'll dispatch an action that could be handled by a dialog
		this.actions.dispatch(
			PluginSettingsActions.openCreateSettingDialog({
				pluginId: this.plugin.id
			})
		);
	}

	public onEditSetting(settingKey: string): void {
		const currentValue = this.settingsForm.get(settingKey)?.value;
		this.actions.dispatch(
			PluginSettingsActions.startEditSetting({
				settingKey,
				currentValue
			})
		);
	}

	public onSaveSettingEdit(settingKey: string): void {
		this.query
			.getEditFormData$(settingKey)
			.pipe(
				take(1),
				filter((formData) => !!formData)
			)
			.subscribe((formData) => {
				const newValue = formData.value;
				// Update the main form
				this.settingsForm.get(settingKey)?.setValue(newValue);
				// Dispatch save action
				this.actions.dispatch(
					PluginSettingsActions.saveSettingEdit({
						settingKey,
						newValue
					})
				);
			});
	}

	public onCancelSettingEdit(settingKey: string): void {
		this.actions.dispatch(PluginSettingsActions.cancelSettingEdit({ settingKey }));
	}

	public getEditFormValue(settingKey: string): Observable<any> {
		return this.query.getEditFormValue$(settingKey);
	}

	public updateEditFormValue(settingKey: string, value: any): void {
		this.actions.dispatch(PluginSettingsActions.updateEditFormValue({ settingKey, value }));
	}

	public isSettingBeingEdited(settingKey: string): Observable<boolean> {
		return this.query.isSettingBeingEdited$(settingKey);
	}

	public getOptionLabel(setting: IPluginSetting, value: any): string {
		if (!setting.options) {
			return value?.toString() || '';
		}
		const option = setting.options.find((opt) => opt.value === value);
		return option?.label || value?.toString() || '';
	}

	public trackBySettingKey(index: number, setting: IPluginSetting): string {
		return setting.key;
	}

	public trackByGroupCategory(index: number, group: IPluginSettingGroup): string {
		return group.category;
	}

	public close(): void {
		this.query
			.hasAnyEditingSettings$()
			.pipe(take(1))
			.subscribe((hasEdits) => {
				if (hasEdits) {
					if (!confirm('You have unsaved edits. Are you sure you want to close?')) {
						return;
					}
				}
				this.dialogRef.close();
			});
	}
}
