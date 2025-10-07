import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { tap, catchError, finalize } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { ToastrService, IntegrationTenantService, Store } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';
import { IntegrationEnum, IIntegrationTenant, IOrganization } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-activepieces-settings',
	templateUrl: './activepieces-settings.component.html',
	styleUrls: ['./activepieces-settings.component.scss'],
	standalone: false
})
export class ActivepiecesSettingsComponent extends TranslationBaseComponent implements OnInit {
	public form: FormGroup;
	public loading = false;
	public integrationId: string;
	public organization: IOrganization;

	constructor(
		private readonly _fb: FormBuilder,
		private readonly _integrationTenantService: IntegrationTenantService,
		private readonly _toastrService: ToastrService,
		private readonly _route: ActivatedRoute,
		private readonly _store: Store,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._initializeForm();
		this._loadOrganization();
		this._loadIntegrationId();
	}

	private _initializeForm() {
		this.form = this._fb.group({
			client_id: ['', [Validators.required]],
			client_secret: ['', [Validators.required]],
			callback_url: [''],
			post_install_url: [''],
			state_secret: ['', [Validators.required, Validators.minLength(32)]]
		});
	}

	private _loadOrganization() {
		this._store.selectedOrganization$
			.pipe(
				tap((organization) => {
					this.organization = organization;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _loadIntegrationId() {
		this._route.parent.params
			.pipe(
				tap((params) => {
					this.integrationId = params['id'];
					if (this.integrationId) {
						this._loadSettings();
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _loadSettings() {
		if (!this.integrationId) return;

		this.loading = true;
		this._integrationTenantService
			.getById(this.integrationId, ['settings'])
			.pipe(
				tap((integrationTenant: IIntegrationTenant) => {
					if (integrationTenant?.settings) {
						const settings = integrationTenant.settings.reduce((acc, setting) => {
							acc[setting.settingsName] = setting.settingsValue;
							return acc;
						}, {});

						this.form.patchValue(settings);
					}
				}),
				catchError((error) => {
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.ACTIVEPIECES_PAGE.ERRORS.LOAD_SETTINGS'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					console.error('Error loading ActivePieces settings:', error);
					return EMPTY;
				}),
				finalize(() => {
					this.loading = false;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Save ActivePieces tenant-specific settings
	 */
	saveSettings() {
		if (this.form.invalid) {
			this._toastrService.error(
				this.getTranslation('INTEGRATIONS.ACTIVEPIECES_PAGE.ERRORS.INVALID_FORM'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
			return;
		}

		if (!this.organization) {
			this._toastrService.error(
				this.getTranslation('INTEGRATIONS.ACTIVEPIECES_PAGE.ERRORS.NO_ORGANIZATION'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
			return;
		}

		const { id: organizationId, tenantId } = this.organization;
		const formValues = this.form.value;

		// Prepare settings array for integration tenant
		const settings = Object.keys(formValues)
			.filter((key) => formValues[key]) // Only include non-empty values
			.map((key) => ({
				settingsName: key,
				settingsValue: formValues[key]
			}));

		const integrationTenantInput = {
			name: IntegrationEnum.ACTIVE_PIECES,
			integration: IntegrationEnum.ACTIVE_PIECES,
			tenantId,
			organizationId,
			settings
		};

		this.loading = true;
		this._integrationTenantService
			.create(integrationTenantInput)
			.pipe(
				tap(() => {
					this._toastrService.success(
						this.getTranslation('INTEGRATIONS.ACTIVEPIECES_PAGE.SUCCESS.SETTINGS_SAVED'),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
				}),
				catchError((error) => {
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.ACTIVEPIECES_PAGE.ERRORS.SAVE_SETTINGS'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					console.error('Error saving ActivePieces settings:', error);
					return EMPTY;
				}),
				finalize(() => {
					this.loading = false;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}
}
