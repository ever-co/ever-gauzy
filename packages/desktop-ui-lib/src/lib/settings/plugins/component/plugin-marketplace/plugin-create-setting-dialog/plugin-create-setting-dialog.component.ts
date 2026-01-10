import { AfterViewInit, ChangeDetectionStrategy, Component, inject, Inject, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { NB_DIALOG_CONFIG, NbDialogRef } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { asyncScheduler, distinctUntilChanged, filter, map, tap } from 'rxjs';
import { PluginSettingsActions } from '../+state/actions/plugin-settings.actions';
import { PluginCategoryQuery } from '../+state/queries/plugin-category.query';
import {
	IPluginSettingCreateInput,
	PluginSettingScope,
	PluginSettingType
} from '../../../services/plugin-settings.service';
import { CategorySelectorComponent } from '../plugin-marketplace-item/category-selector/category-selector.component';

export interface CreatePluginSettingDialogData {
	pluginId: string;
	tenantId?: string;
	organizationId?: string;
	userId?: string;
}

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'lib-plugin-create-setting-dialog',
	templateUrl: './plugin-create-setting-dialog.component.html',
	styleUrls: ['./plugin-create-setting-dialog.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false
})
export class PluginCreateSettingDialogComponent implements OnInit, AfterViewInit {
	public createForm: FormGroup;
	public submitting = false;
	public data: CreatePluginSettingDialogData;

	public readonly settingTypes = Object.values(PluginSettingType);
	public readonly settingScopes = Object.values(PluginSettingScope);

	@ViewChild(CategorySelectorComponent) categorySelector: CategorySelectorComponent;

	// Use inject for dependencies following Angular 20 best practices
	private readonly formBuilder = inject(FormBuilder);
	private readonly actions = inject(Actions);
	private readonly categoryQuery = inject(PluginCategoryQuery);

	constructor(
		@Inject(NB_DIALOG_CONFIG) config: { data: CreatePluginSettingDialogData },
		private readonly dialogRef: NbDialogRef<PluginCreateSettingDialogComponent>
	) {
		this.data = config.data;
		this.initializeForm();
	}

	ngOnInit(): void {
		// Any additional initialization
	}

	ngAfterViewInit(): void {
		this.syncCategoryWithForm();
	}

	private initializeForm(): void {
		this.createForm = this.formBuilder.group({
			key: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9_-]+$/)]],
			label: ['', Validators.required],
			description: [''],
			type: [PluginSettingType.STRING, Validators.required],
			scope: [PluginSettingScope.GLOBAL, Validators.required],
			categoryId: [null],
			value: [''],
			defaultValue: [''],
			isRequired: [false],
			isEncrypted: [false],
			isVisible: [true]
		});
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
		return this.createForm.get('categoryId') as FormControl<string>;
	}

	public onSubmit(): void {
		if (this.createForm.valid && !this.submitting) {
			this.submitting = true;
			const formValue = this.createForm.value;

			const newSetting: IPluginSettingCreateInput = {
				pluginId: this.data.pluginId,
				key: formValue.key,
				label: formValue.label,
				description: formValue.description,
				type: formValue.type,
				scope: formValue.scope,
				categoryId: formValue.categoryId,
				value: formValue.value || formValue.defaultValue,
				isRequired: formValue.isRequired,
				isEncrypted: formValue.isEncrypted,
				isVisible: formValue.isVisible,
				validation: {},
				options: []
			};

			this.actions.dispatch(
				PluginSettingsActions.createSetting({
					pluginId: this.data.pluginId,
					setting: newSetting
				})
			);

			// Close dialog after a short delay to allow the action to be processed
			asyncScheduler.schedule(() => {
				this.submitting = false;
				this.dialogRef.close(true);
			}, 500);
		}
	}

	public cancel(): void {
		this.dialogRef.close(false);
	}
}
