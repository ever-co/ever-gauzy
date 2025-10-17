import { Component, OnInit, OnDestroy } from '@angular/core';
import { UntypedFormGroup, UntypedFormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { tap, catchError, finalize, filter } from 'rxjs/operators';
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
export class ActivepiecesSettingsComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public loading = false;
	public integrationId!: string;
	public organization!: IOrganization;

	readonly form: UntypedFormGroup = ActivepiecesSettingsComponent.buildForm(this._fb);

	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			client_id: [null, Validators.required],
			client_secret: [null, Validators.required],
			state_secret: [null, [Validators.required, Validators.minLength(32)]],
			callback_url: [null],
			post_install_url: [null]
		});
	}

	constructor(
		private readonly _fb: UntypedFormBuilder,
		private readonly _integrationTenantService: IntegrationTenantService,
		private readonly _toastrService: ToastrService,
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _store: Store,
		public override readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				untilDestroyed(this)
			)
			.subscribe();

		this._activatedRoute.parent?.params
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

	/**
	 * Load existing settings for the integration
	 */
	private _loadSettings() {
		if (!this.integrationId) return;

		this.loading = true;
		this._integrationTenantService
			.getAll({ id: this.integrationId } as any, ['settings'])
			.pipe(
				tap(({ items }) => {
					const integrationTenant = items?.[0] as IIntegrationTenant | undefined;
					if (integrationTenant?.settings) {
						const settings = integrationTenant.settings.reduce<Record<string, any>>((acc, setting) => {
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
	 * POST /integration-tenant
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

	ngOnDestroy(): void {}
}
