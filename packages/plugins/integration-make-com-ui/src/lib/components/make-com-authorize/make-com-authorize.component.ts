import { Component, OnInit, OnDestroy } from '@angular/core';
import { UntypedFormGroup, UntypedFormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY } from 'rxjs';
import { tap, switchMap, filter, debounceTime, catchError } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IIntegrationTenant, IOrganization, IntegrationEnum } from '@gauzy/contracts';
import { IntegrationsService, Store, MakeComService, MakeComStoreService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-make-com-authorize',
	templateUrl: './make-com-authorize.component.html',
	styleUrls: ['./make-com-authorize.component.scss'],
	standalone: false
})
export class AuthorizationComponent implements OnInit, OnDestroy {
	public rememberState: boolean = false;
	public organization: IOrganization | null = null;
	public loading: boolean = false;

	readonly form: UntypedFormGroup = AuthorizationComponent.buildForm(this._fb);
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			clientId: [null, Validators.required],
			clientSecret: [null, Validators.required]
		});
	}

	constructor(
		private readonly _fb: UntypedFormBuilder,
		private readonly _makeComService: MakeComService,
		private readonly _makeComStoreService: MakeComStoreService,
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _router: Router,
		private readonly _store: Store,
		private readonly _integrationsService: IntegrationsService
	) {}

	ngOnInit() {
		this._store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				untilDestroyed(this)
			)
			.subscribe();

		this._activatedRoute.data
			.pipe(
				debounceTime(100),
				filter(({ state }) => !!state),
				tap(({ state }) => (this.rememberState = state)),
				tap(() => this._handleOAuthFlow()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Handle the OAuth flow - either process callback or check remembered state
	 */
	private _handleOAuthFlow() {
		this._activatedRoute.queryParams
			.pipe(
				switchMap((params) => {
					// If we have code and state parameters, this is a callback from Make.com
					if (params && params['code'] && params['state']) {
						return this._handleOAuthCallback(params['code'], params['state']);
					}

					// If remember state is true, check for existing integration
					if (this.rememberState) {
						return this._checkRememberState();
					}

					return EMPTY;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Process OAuth callback parameters
	 */
	private _handleOAuthCallback(code: string, state: string) {
		// Note: This is a user-interface call to display the callback results
		// The actual exchange is handled by the backend automatically
		this.loading = true;

		return this._makeComService.handleOAuthCallback(code, state).pipe(
			tap(() => {
				// Redirect to dashboard or appropriate page after successful authentication
				this._redirectToIntegrationsList();
			}),
			catchError((error) => {
				console.error('Error processing OAuth callback:', error);
				this.loading = false;
				return EMPTY;
			})
		);
	}

	/**
	 * Check for existing Make.com integration
	 */
	private _checkRememberState() {
		if (!this.organization) {
			return EMPTY;
		}

		const { id: organizationId, tenantId } = this.organization;
		this.loading = true;

		return this._integrationsService
			.getIntegrationByOptions({
				name: IntegrationEnum.MakeCom,
				organizationId,
				tenantId
			})
			.pipe(
				filter((integration: IIntegrationTenant) => !!integration.id),
				tap((integration: IIntegrationTenant) => {
					if (integration.id) {
						this._redirectToMakeComIntegration(integration.id);
					}
					this.loading = false;
				}),
				catchError((error) => {
					console.error('Error checking remembered state:', error);
					this.loading = false;
					return EMPTY;
				})
			);
	}

	/**
	 * Authorize Make.com integration with the provided credentials
	 */
	authorizeMakeCom(credentials: { clientId: string; clientSecret: string }) {
		if (!this.organization || this.form.invalid) {
			return;
		}

		this.loading = true;

		// Update OAuth settings
		this._makeComStoreService
			.updateOAuthSettings(credentials)
			.pipe(
				switchMap(() => {
					// After updating OAuth settings, initiate the OAuth flow
					// Get OAuth config
					return this._makeComStoreService.loadOAuthConfig();
				}),
				tap((config) => {
					// Generate authorization URL with a state parameter
					const state = this._generateRandomState();
					const authUrl = this._makeComStoreService.getAuthorizeUrl(state);

					// Redirect user to Make.com authorization page
					window.location.href = authUrl;
				}),
				catchError((error) => {
					console.error('Error during Make.com authorization:', error);
					this.loading = false;
					return EMPTY;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Generate a random state parameter for OAuth security
	 */
	private _generateRandomState(): string {
		const array = new Uint32Array(8);
		window.crypto.getRandomValues(array);
		return Array.from(array, (x) => x.toString(16).padStart(8, '0')).join('');
	}

	/**
	 * Redirect to Make.com integration page
	 */
	private _redirectToMakeComIntegration(integrationId: string) {
		this._router.navigate(['pages/integrations/make-com', integrationId]);
	}

	/**
	 * Redirect to the integrations list page
	 */
	private _redirectToIntegrationsList() {
		this._router.navigate(['pages/integrations']);
	}

	ngOnDestroy(): void {}
}
