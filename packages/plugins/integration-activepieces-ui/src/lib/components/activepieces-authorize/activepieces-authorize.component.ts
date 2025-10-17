import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
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

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-activepieces-authorize',
	templateUrl: './activepieces-authorize.component.html',
	styleUrls: ['./activepieces-authorize.component.scss'],
	standalone: false
})
export class ActivepiecesAuthorizeComponent implements OnInit, OnDestroy {
	public rememberState = false;
	public organization!: IOrganization;
	public hasTenantSettings = false;
	public loading = false;

	readonly form: UntypedFormGroup = ActivepiecesAuthorizeComponent.buildForm(this._fb);

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
		private readonly _activepiecesService: ActivepiecesService,
		private readonly _integrationTenantService: IntegrationTenantService,
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _router: Router,
		readonly _store: Store,
		private readonly _integrationsService: IntegrationsService,
		private readonly _toastrService: ToastrService
	) {}

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
			.get({
				where: {
					name: IntegrationEnum.ACTIVE_PIECES,
					organizationId,
					tenantId
				},
				relations: ['settings']
			})
			.pipe(
				tap((integrationTenants: any) => {
					if (integrationTenants && integrationTenants.items && integrationTenants.items.length > 0) {
						const integrationTenant = integrationTenants.items[0];
						const hasClientId = integrationTenant.settings?.some(
							(s: any) => s.settingsName === 'client_id'
						);
						const hasClientSecret = integrationTenant.settings?.some(
							(s: any) => s.settingsName === 'client_secret'
						);
						this.hasTenantSettings = hasClientId && hasClientSecret;
					}
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
	 * POST /integration-tenant
	 */
	setupAndAuthorize() {
		if (this.form.invalid || !this.organization) {
			this._toastrService.error('Please fill all required fields correctly');
			return;
		}

		this.loading = true;
		const { id: organizationId, tenantId } = this.organization;
		const formValues = this.form.value;

		// Prepare settings array for integration tenant
		const settings = Object.keys(formValues)
			.filter((key) => formValues[key])
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

		this._integrationTenantService
			.create(integrationTenantInput)
			.pipe(
				tap(() => {
					this._toastrService.success('Settings saved successfully');
					this.hasTenantSettings = true;
				}),
				switchMap(() => this._startAuthorization()),
				catchError((error) => {
					this._toastrService.error('Failed to save settings: ' + error.message);
					this.loading = false;
					return EMPTY;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Start OAuth authorization flow (if tenant settings already exist)
	 * GET /integration/activepieces/authorize?organizationId={orgId}
	 */
	startAuthorization() {
		this.loading = true;
		this._startAuthorization()
			.pipe(
				catchError((error) => {
					this._toastrService.error('Failed to start authorization: ' + error.message);
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

		// GET /integration/activepieces/authorize?organizationId={orgId}
		return this._activepiecesService.authorize(this.organization.id).pipe(
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
		this._router.navigate(['pages/integrations/activepieces', integrationId]);
	}

	ngOnDestroy(): void {}
}
