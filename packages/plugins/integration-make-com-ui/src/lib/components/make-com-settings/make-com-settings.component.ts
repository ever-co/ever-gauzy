import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { tap, catchError } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { MakeComStoreService } from '@gauzy/ui-core/core/src/lib/services/make-com/make-com-store.service';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-make-com-settings',
	templateUrl: './make-com-settings.component.html',
	standalone: false
})
export class MakeComSettingsComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public form: FormGroup;
	public loading: boolean = false;
	public settings: any = null;

	constructor(
		private readonly _fb: FormBuilder,
		private readonly _makeComStoreService: MakeComStoreService,
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
				tap((settings) => {
					this.settings = settings;
					this.form.patchValue({
						isEnabled: settings.isEnabled,
						webhookUrl: settings.webhookUrl
					});
				}),
				catchError((error) => {
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
		if (this.form.invalid) return;

		this.loading = true;
		this._makeComStoreService
			.updateIntegrationSettings(this.form.value)
			.pipe(
				tap((settings) => {
					this.settings = settings;
				}),
				catchError((error) => {
					console.error('Error saving Make.com settings:', error);
					return EMPTY;
				}),
				untilDestroyed(this)
			)
			.subscribe(() => {
				this.loading = false;
			});
	}

	ngOnDestroy(): void {}
}
