import { Component, OnInit, OnDestroy } from '@angular/core';
import { UntypedFormGroup, UntypedFormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY } from 'rxjs';
import { tap, switchMap, filter, debounceTime, catchError } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IIntegrationTenant, IOrganization, IntegrationEnum } from '@gauzy/contracts';
import {
	ActivepiecesService,
	IntegrationsService,
	IntegrationTenantService,
	Store,
	ToastrService
} from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-activepieces-authorize',
	templateUrl: './activepieces-authorize.component.html',
	styleUrls: ['./activepieces-authorize.component.scss'],
	standalone: false
})
export class ActivepiecesAuthorizeComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public rememberState = false;
	public organization!: IOrganization;
	public hasTenantSettings = false;
	public loading = false;

	readonly form: UntypedFormGroup = ActivepiecesAuthorizeComponent.buildForm(this._fb);

	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			client_id: [null, Validators.required],
			client_secret: [null, Validators.required],
		});
	}

	constructor(
		private readonly _fb: UntypedFormBuilder,
		private readonly _activepiecesService: ActivepiecesService,
		private readonly _integrationTenantService: IntegrationTenantService,
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _router: Router,
		readonly _store: Store,
		private readonly _integrationsService: IntegrationsService,
		private readonly _toastrService: ToastrService,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this._checkTenantSettings()),
				untilDestroyed(this)
			)
			.subscribe();

		this._activatedRoute.data
			.pipe(
				debounceTime(100),
				filter(({ state }) => !!state),
				tap(({ state }) => (this.rememberState = state)),
				tap(() => this._checkRememberState()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Check if tenant has OAuth settings configured
	 */
	private _checkTenantSettings() {
		if (!this.organization) {
			return;
		}

		const { id: organizationId, tenantId } = this.organization;

		this._integrationTenantService
			.getAll(
				{
					name: IntegrationEnum.ACTIVE_PIECES,
					organizationId,
					tenantId
				},
				['settings']
			)
			.pipe(
				tap((integrationTenants) => {
					const integrationTenant = integrationTenants?.items?.[0];
					if (!integrationTenant) return;
					const { settings } = integrationTenant;
					this.hasTenantSettings = Boolean(
						settings?.some((s) => s.settingsName === 'client_id') &&
						settings?.some((s) => s.settingsName === 'client_secret')
					);
				}),
				catchError(() => EMPTY),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * ActivePieces integration remember state API call
	 */
	private _checkRememberState() {
		if (!this.organization || !this.rememberState) {
			return;
		}

		const { id: organizationId, tenantId } = this.organization;
		this._integrationsService
			.getIntegrationByOptions({
				name: IntegrationEnum.ACTIVE_PIECES,
				organizationId,
				tenantId
			})
			.pipe(
				filter((integration: IIntegrationTenant) => !!integration && !!integration.id),
				tap((integration: IIntegrationTenant) => {
					if (!integration?.id) return;
					this._redirectToActivepiecesIntegration(integration.id);
				}),
				catchError(() => EMPTY),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Save tenant settings and start OAuth flow
	 * POST /integration/activepieces/oauth/settings
	 */
	setupAndAuthorize() {
		if (this.form.invalid || !this.organization) {
			this._toastrService.error(this.getTranslation('ACTIVEPIECES_PAGE.AUTHORIZE.ERRORS.INVALID_FORM'));
			return;
		}

		this.loading = true;
		const { id: organizationId } = this.organization;
		const { client_id, client_secret } = this.form.value;

		this._activepiecesService
			.saveOAuthSettings(client_id, client_secret, organizationId)
			.pipe(
				tap(() => {
					this._toastrService.success(this.getTranslation('ACTIVEPIECES_PAGE.AUTHORIZE.SUCCESS.SETTINGS_SAVED'));
					this.hasTenantSettings = true;
				}),
				switchMap(() => this._startAuthorization()),
				catchError((error) => {
					const errorMessage = this.getTranslation('ACTIVEPIECES_PAGE.AUTHORIZE.ERRORS.SAVE_SETTINGS') + ': ' + error.message;
					this._toastrService.error(errorMessage);
					this.loading = false;
					return EMPTY;
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
			// Optional: toast an error here if desired
			return;
		}
		this.loading = true;
		this._startAuthorization()
			.pipe(
				catchError((error) => {
					const errorMessage = this.getTranslation('ACTIVEPIECES_PAGE.AUTHORIZE.ERRORS.START_AUTHORIZATION') + ': ' + error.message;
					this._toastrService.error(errorMessage);
					this.loading = false;
					return EMPTY;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Internal method to start authorization
	 */
	private _startAuthorization() {
		if (!this.organization) {
			return EMPTY;
		}

		const { id: organizationId, tenantId } = this.organization;

		// GET /integration/activepieces/authorize?tenantId={tenantId}&organizationId={orgId}
		return this._activepiecesService.authorize(tenantId, organizationId).pipe(
			tap((response: { authorizationUrl: string; state: string }) => {
				// Redirect to ActivePieces OAuth page
				window.location.href = response.authorizationUrl;
			})
		);
	}

	/**
	 * Redirect to ActivePieces integration page
	 */
	private _redirectToActivepiecesIntegration(integrationId: string) {
		this._router.navigate(['/pages/integrations/activepieces', integrationId]);
	}

	ngOnDestroy(): void {}
}
