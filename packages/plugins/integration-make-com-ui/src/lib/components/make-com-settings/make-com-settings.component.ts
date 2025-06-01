import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { tap, catchError } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { MakeComStoreService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';
import { IMakeComIntegrationSettings } from '@gauzy/contracts';
import { ToastrService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-make-com-settings',
	templateUrl: './make-com-settings.component.html',
	standalone: false
})
export class MakeComSettingsComponent extends TranslationBaseComponent implements OnInit {
	public form: FormGroup;
	public loading = false;
	public settings: IMakeComIntegrationSettings = null;

	constructor(
		private readonly _fb: FormBuilder,
		private readonly _makeComStoreService: MakeComStoreService,
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
			webhookUrl: ['', [Validators.required, Validators.pattern('https?://.+')]]
		});
	}

	private _loadSettings() {
		this.loading = true;
		this._makeComStoreService
			.loadIntegrationSettings()
			.pipe(
				tap((settings: IMakeComIntegrationSettings) => {
					this.settings = settings;
					this.form.patchValue({
						isEnabled: settings.isEnabled,
						webhookUrl: settings.webhookUrl
					});
				}),
				catchError((error) => {
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.MAKE_COM_PAGE.ERRORS.LOAD_SETTINGS'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					console.error('Error loading Make.com settings:', error);
					return EMPTY;
				}),
				untilDestroyed(this)
			)
			.subscribe(() => {
				this.loading = false;
			});
	}

	/**
	 * Save Make.com integration settings
	 */
	saveSettings() {
		if (this.form.invalid) {
			this._toastrService.error(
				this.getTranslation('INTEGRATIONS.MAKE_COM_PAGE.ERRORS.INVALID_FORM'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
			return;
		}

		this.loading = true;
		this._makeComStoreService
			.updateIntegrationSettings(this.form.value)
			.pipe(
				tap((settings: IMakeComIntegrationSettings) => {
					this.settings = settings;
					this._toastrService.success(
						this.getTranslation('INTEGRATIONS.MAKE_COM_PAGE.SUCCESS.SETTINGS_SAVED'),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
				}),
				catchError((error) => {
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.MAKE_COM_PAGE.ERRORS.SAVE_SETTINGS'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					console.error('Error saving Make.com settings:', error);
					return EMPTY;
				}),
				untilDestroyed(this)
			)
			.subscribe(() => {
				this.loading = false;
			});
	}
}
