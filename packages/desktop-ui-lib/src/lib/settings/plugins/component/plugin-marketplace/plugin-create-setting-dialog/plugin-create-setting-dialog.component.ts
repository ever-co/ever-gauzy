import { ChangeDetectionStrategy, Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NB_DIALOG_CONFIG, NbDialogRef } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy } from '@ngneat/until-destroy';
import { asyncScheduler } from 'rxjs';
import { PluginSettingsActions } from '../+state/actions/plugin-settings.actions';
import {
	IPluginSettingCreateInput,
	PluginSettingScope,
	PluginSettingType
} from '../../../services/plugin-settings.service';

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
export class PluginCreateSettingDialogComponent implements OnInit {
	public createForm: FormGroup;
	public submitting = false;
	public data: CreatePluginSettingDialogData;

	public readonly settingTypes = Object.values(PluginSettingType);
	public readonly settingScopes = Object.values(PluginSettingScope);

	constructor(
		@Inject(NB_DIALOG_CONFIG) config: { data: CreatePluginSettingDialogData },
		private readonly dialogRef: NbDialogRef<PluginCreateSettingDialogComponent>,
		private readonly formBuilder: FormBuilder,
		private readonly actions: Actions
	) {
		this.data = config.data;
		this.initializeForm();
	}

	ngOnInit(): void {
		// Any additional initialization
	}

	private initializeForm(): void {
		this.createForm = this.formBuilder.group({
			key: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9_-]+$/)]],
			label: ['', Validators.required],
			description: [''],
			type: [PluginSettingType.STRING, Validators.required],
			scope: [PluginSettingScope.GLOBAL, Validators.required],
			category: ['general'],
			value: [''],
			defaultValue: [''],
			isRequired: [false],
			isEncrypted: [false],
			isVisible: [true]
		});
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
				category: formValue.category,
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
