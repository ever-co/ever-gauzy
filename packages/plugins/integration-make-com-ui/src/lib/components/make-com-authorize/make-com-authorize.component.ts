import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { tap, catchError, filter } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { MakeComService, ToastrService, Store } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';
import { IMakeComCreateIntegration, IOrganization, IIntegrationTenant, IntegrationEnum } from '@gauzy/contracts';
import { Router, ActivatedRoute } from '@angular/router';
import { IntegrationsService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-make-com-authorize',
	templateUrl: './make-com-authorize.component.html',
	styleUrls: ['./make-com-authorize.component.scss'],
	standalone: false
})
export class AuthorizationComponent extends TranslationBaseComponent implements OnInit {
	public form: FormGroup;
	public loading = false;
	public oauthConfig: { clientId: string; redirectUri: string } = null;
	public organization: IOrganization;
	public rememberState: boolean;
	private static readonly MAKE_DASHBOARD_ROUTE = '/pages/integrations/makecom';

	constructor(
		private readonly _fb: FormBuilder,
		private readonly _makeComService: MakeComService,
		private readonly _toastrService: ToastrService,
		public readonly translateService: TranslateService,
		private readonly _router: Router,
		private readonly _route: ActivatedRoute,
		private readonly _store: Store,
		private readonly _integrationsService: IntegrationsService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._initializeForm();
		this._loadOrganization();
		this._loadOAuthConfig();
	}

	private _initializeForm() {
		this.form = this._fb.group({
			clientId: ['', [Validators.required]],
			clientSecret: ['', [Validators.required]]
		});
	}

	private _loadOrganization() {
		this._store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this._checkRememberState()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _loadOAuthConfig() {
		this.loading = true;
		this._makeComService
			.getOAuthConfig()
			.pipe(
				tap((config) => {
					this.oauthConfig = config;
				}),
				catchError((error) => {
					console.error('Error loading OAuth config:', error);
					return EMPTY;
				}),
				untilDestroyed(this)
			)
			.subscribe(() => {
				this.loading = false;
			});
	}

	/**
	 * Check if there's an existing Make.com integration
	 */
	private _checkRememberState() {
		if (!this.organization) {
			return;
		}

		// Get the state from route data
		this._route.data.subscribe((data) => {
			this.rememberState = data.state;

			// Only check for existing integration if state is true
			if (this.rememberState) {
				const { id: organizationId, tenantId } = this.organization;
				const state$ = this._integrationsService.getIntegrationByOptions({
					name: IntegrationEnum.MakeCom,
					organizationId,
					tenantId
				});
				state$
					.pipe(
						filter((integration: IIntegrationTenant) => !!integration.id),
						tap((integration: IIntegrationTenant) => {
							this._redirectToMakeDashboard(integration.id);
						}),
						catchError((error) => {
							console.error('Error checking integration state:', error);
							return EMPTY;
						}),
						untilDestroyed(this)
					)
					.subscribe();
			}
		});
	}

	/**
	 * Start OAuth authorization flow
	 */
	startAuthorization() {
		if (this.form.invalid || !this.organization) {
			this._toastrService.error(
				this.getTranslation('INTEGRATIONS.MAKE_PAGE.ERRORS.INVALID_FORM'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
			return;
		}

		this.loading = true;
		const credentials: IMakeComCreateIntegration = this.form.value;

		this._makeComService
			.addOAuthSettings(credentials)
			.pipe(
				tap((response) => {
					// Redirect to Make.com authorization page
					window.location.href = response.authorizationUrl;
				}),
				catchError((error) => {
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.MAKE_COM_PAGE.ERRORS.START_AUTHORIZATION'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					console.error('Error starting authorization:', error);
					return EMPTY;
				}),
				untilDestroyed(this)
			)
			.subscribe(() => {
				this.loading = false;
			});
	}

	/**
	 * Redirect to Make.com dashboard
	 */
	private _redirectToMakeDashboard(integrationId: string) {
		this._router.navigate([AuthorizationComponent.MAKE_DASHBOARD_ROUTE, integrationId]);
	}
}
