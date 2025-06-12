import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { tap, catchError } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { ZapierService, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';
import { IZapierIntegrationSettings } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-zapier-settings',
	templateUrl: './zapier-settings.component.html',
	styleUrls: ['./zapier-settings.component.scss'],
	standalone: false
})
export class ZapierSettingsComponent extends TranslationBaseComponent implements OnInit {
	public form: FormGroup;
	public loading = false;
	public settings: IZapierIntegrationSettings = null;

	constructor(
		private readonly _fb: FormBuilder,
		private readonly _zapierService: ZapierService,
		private readonly _toastrService: ToastrService,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._initializeForm();
		this._loadSettings();
	}

	private _initializeForm() {
		this.form = this._fb.group({
			isEnabled: [false],
			webhookUrl: ['']
		});
		this.form.get('isEnabled').valueChanges.subscribe((isEnabled) => {
			const webhookUrlControl = this.form.get('webhookUrl');
			if (isEnabled) {
				webhookUrlControl.setValidators([Validators.required]);
			} else {
				webhookUrlControl.clearValidators();
			}
			webhookUrlControl.updateValueAndValidity();
		});
	}

	private _loadSettings() {
		this.loading = true;
		this._zapierService
			.getSettings()
			.pipe(
				tap((settings: IZapierIntegrationSettings) => {
					this.settings = settings;
					this.form.patchValue({
						isEnabled: settings.isEnabled,
						webhookUrl: settings.webhookUrl
					});
				}),
				catchError((error) => {
					this.loading = false;
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.ERRORS.LOAD_SETTINGS'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					console.error('Error loading Zapier settings:', error);
					return EMPTY;
				}),
				untilDestroyed(this)
			)
			.subscribe(() => {
				this.loading = false;
			});
	}

	/**
	 * Save Zapier integration settings
	 */
	saveSettings() {
		if (this.form.invalid) {
			this._toastrService.error(
				this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.ERRORS.INVALID_FORM'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
			return;
		}

		this.loading = true;
		this._zapierService
			.updateSettings(this.form.value)
			.pipe(
				tap((settings: IZapierIntegrationSettings) => {
					this.settings = settings;
					this._toastrService.success(
						this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.SUCCESS.SETTINGS_SAVED'),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
				}),
				catchError((error) => {
					this.loading = false;
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.ERRORS.SAVE_SETTINGS'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					console.error('Error saving Zapier settings:', error);
					return EMPTY;
				}),
				untilDestroyed(this)
			)
			.subscribe(() => {
				this.loading = false;
			});
	}
}
