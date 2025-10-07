import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { tap, catchError, finalize, switchMap } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { ActivepiecesService, ToastrService, IntegrationsService, Store, IntegrationTenantService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';
import { IntegrationEnum, IOrganization } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-activepieces-authorize',
	templateUrl: './activepieces-authorize.component.html',
	styleUrls: ['./activepieces-authorize.component.scss'],
	standalone: false
})
export class ActivepiecesAuthorizeComponent extends TranslationBaseComponent implements OnInit {
	public form: FormGroup;
	public loading = false;
	public hasTenantSettings = false;
	public organization: IOrganization;

	constructor(
		private readonly _fb: FormBuilder,
		private readonly _activepiecesService: ActivepiecesService,
		private readonly _integrationTenantService: IntegrationTenantService,
		private readonly _toastrService: ToastrService,
		private readonly _router: Router,
		private readonly _store: Store,
		private readonly _integrationsService: IntegrationsService,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._initializeForm();
		this._loadOrganization()
			.pipe(
				switchMap(() => this._checkExistingIntegration()),
				switchMap(() => this._checkTenantSettings()),
				untilDestroyed(this)
			)
			.subscribe();
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
		return this._store.selectedOrganization$.pipe(
			tap((organization) => {
				this.organization = organization;
			})
		);
	}

	private _checkExistingIntegration() {
		if (!this.organization) return EMPTY;

		const { id: organizationId, tenantId } = this.organization;

		return this._integrationsService
			.getIntegrationByOptions({
				name: IntegrationEnum.ACTIVE_PIECES,
				organizationId,
				tenantId
			})
			.pipe(
				tap((integration) => {
					if (integration) {
						this._router.navigate(['/pages/integrations/activepieces', integration.id]);
					}
				}),
				catchError((error) => {
					console.error('Error checking existing integration:', error);
					return EMPTY;
				}),
				finalize(() => {
					this.loading = false;
				})
			);
	}

	private _checkTenantSettings() {
		if (!this.organization) return EMPTY;

		const { id: organizationId, tenantId } = this.organization;

		return this._integrationTenantService
			.getByOptions({
				where: {
					name: IntegrationEnum.ACTIVE_PIECES,
					organizationId,
					tenantId
				},
				relations: ['settings']
			})
			.pipe(
				tap((integrationTenants) => {
					if (integrationTenants && integrationTenants.items && integrationTenants.items.length > 0) {
						const integrationTenant = integrationTenants.items[0];
						const hasClientId = integrationTenant.settings?.some((s) => s.settingsName === 'client_id');
						const hasClientSecret = integrationTenant.settings?.some((s) => s.settingsName === 'client_secret');

						this.hasTenantSettings = hasClientId && hasClientSecret;
					}
				}),
				catchError((error) => {
					console.error('Error checking tenant settings:', error);
					return EMPTY;
				})
			);
	}

	/**
	 * Save tenant-specific settings and start OAuth flow
	 */
	async setupAndAuthorize() {
		if (this.form.invalid) {
			this._toastrService.error(
				this.getTranslation('INTEGRATIONS.ACTIVEPIECES_PAGE.ERRORS.INVALID_FORM'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
			return;
		}

		if (!this.organization) {
			this.loading = false;
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

		// First, save the tenant settings
		this._integrationTenantService
			.create(integrationTenantInput)
			.pipe(
				tap(() => {
					this._toastrService.success(
						this.getTranslation('INTEGRATIONS.ACTIVEPIECES_PAGE.SUCCESS.SETTINGS_SAVED'),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
				}),
				switchMap(() => this.startAuthorization()),
				catchError((error) => {
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.ACTIVEPIECES_PAGE.ERRORS.SETUP_FAILED'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					console.error('Error setting up ActivePieces integration:', error);
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
	 * Start OAuth authorization flow (if tenant settings already exist)
	 */
	startAuthorization() {
		if (!this.organization) {
			this.loading = false;
			return EMPTY;
		}

		this.loading = true;

		return this._activepiecesService.authorize(this.organization.id).pipe(
			tap((response: { authorizationUrl: string }) => {
				// Redirect to ActivePieces OAuth page
				window.location.href = response.authorizationUrl;
			}),
			catchError((error) => {
				this._toastrService.error(
					this.getTranslation('INTEGRATIONS.ACTIVEPIECES_PAGE.ERRORS.START_AUTHORIZATION'),
					this.getTranslation('TOASTR.TITLE.ERROR')
				);
				console.error('Error starting authorization:', error);
				return EMPTY;
			}),
			finalize(() => {
				this.loading = false;
			}),
			untilDestroyed(this)
		);
	}
}
