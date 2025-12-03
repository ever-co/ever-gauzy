import { ChangeDetectionStrategy, Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { IPlugin } from '@gauzy/contracts';
import { NB_DIALOG_CONFIG, NbDialogRef } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	BehaviorSubject,
	debounceTime,
	distinctUntilChanged,
	filter,
	map,
	Observable,
	startWith,
	switchMap,
	tap
} from 'rxjs';
import { PluginSettingsActions, PluginSettingsQuery } from '../+state';
import {
	IPluginSetting,
	IPluginSettingGroup,
	PluginSettingScope,
	PluginSettingsService,
	PluginSettingType
} from '../../../services/plugin-settings.service';

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
export class PluginSettingsManagementComponent implements OnInit, OnDestroy {
	public plugin: IPlugin;
	public settingsForm: FormGroup;
	public searchForm: FormGroup;
	public installationId?: string;
	public scope: string;
	public organizationId?: string;
	public tenantId?: string;

	// State observables
	public settingsGroups$ = this.query.settingsGroups$;
	public filteredGroups$ = this.query.settingsByCategory$;
	public categories$ = this.query.categories$;
	public loading$ = this.query.isLoading$;
	public saving$ = this.query.isSaving$;
	public validating$ = this.query.isValidating$;
	public validationErrors$ = this.query.validationErrors$;
	public hasUnsavedChanges$ = this.query.hasUnsavedChanges$;
	public isFormValid$ = this.query.isFormValid$;

	// Local state for search
	private readonly searchTerm$ = new BehaviorSubject<string>('');
	private readonly selectedCategory$ = new BehaviorSubject<string>('all');

	// Loading state
	public submitting = false;

	// Setting types enum for template
	public readonly PluginSettingType = PluginSettingType;

	constructor(
		@Inject(NB_DIALOG_CONFIG) public data: PluginSettingsDialogData,
		private readonly dialogRef: NbDialogRef<PluginSettingsManagementComponent>,
		private readonly formBuilder: FormBuilder,
		private readonly pluginSettingsService: PluginSettingsService,
		private readonly query: PluginSettingsQuery,
		private readonly actions: Actions
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

	ngOnDestroy(): void {
		this.searchTerm$.complete();
		this.selectedCategory$.complete();
		this.actions.dispatch(PluginSettingsActions.clearSelection());
	}

	private initializeForms(): void {
		this.settingsForm = this.formBuilder.group({});
		this.searchForm = this.formBuilder.group({
			searchTerm: [''],
			category: ['all']
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
					this.searchTerm$.next(term || '');
					this.actions.dispatch(PluginSettingsActions.setSearchTerm({ searchTerm: term || '' }));
				}),
				untilDestroyed(this)
			)
			.subscribe();

		// Handle category filter changes
		this.searchForm
			.get('category')
			?.valueChanges.pipe(
				startWith('all'),
				distinctUntilChanged(),
				tap((category) => {
					this.selectedCategory$.next(category || 'all');
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
			const updates = {
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

	public close(): void {
		this.dialogRef.close();
	}
}
