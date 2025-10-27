import { Component, OnInit, OnDestroy } from '@angular/core';
import { UntypedFormGroup, UntypedFormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY } from 'rxjs';
import { tap, switchMap, filter, catchError, take } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IActivepiecesConnection, IActivepiecesOAuthTokens, IOrganization } from '@gauzy/contracts';
import { ActivepiecesService, Store, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-activepieces-callback',
	templateUrl: './activepieces-callback.component.html',
	styleUrls: ['./activepieces-callback.component.scss'],
	standalone: false
})
export class ActivepiecesCallbackComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public loading = false;
	public organization!: IOrganization;
	public showProjectIdForm = false;

	readonly form: UntypedFormGroup = ActivepiecesCallbackComponent.buildForm(this._fb);

	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			projectId: [null, Validators.required]
		});
	}

	constructor(
		private readonly _fb: UntypedFormBuilder,
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _router: Router,
		private readonly _activepiecesService: ActivepiecesService,
		private readonly _store: Store,
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
				take(1),
			    tap(() => this._handleCallback()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Handle OAuth callback
	 * GET /integration/activepieces/callback redirects here with code and state
	 */
	private _handleCallback() {
		this._activatedRoute.queryParams
			.pipe(
				switchMap((params) => {
					const { code, state } = params;

					if (!code || !state) {
						this._toastrService.error(this.getTranslation('ACTIVEPIECES_PAGE.CALLBACK.ERRORS.INVALID_PARAMETERS'));
						this._redirectToIntegrations();
						return EMPTY;
					}

					if (!this.organization) {
						this._toastrService.error(this.getTranslation('ACTIVEPIECES_PAGE.CALLBACK.ERRORS.ORGANIZATION_NOT_FOUND'));
						this._redirectToIntegrations();
						return EMPTY;
					}

					this.loading = true;

					// Step 1: Exchange authorization code for access token
					// POST /integration/activepieces/oauth/token
					return this._activepiecesService.exchangeToken({ code, state }).pipe(
						tap((tokenResponse: IActivepiecesOAuthTokens) => {
							// Store token response temporarily
							this._storeAccessToken(tokenResponse.access_token);
							// Show project ID form
							this.showProjectIdForm = true;
							this.loading = false;
						}),
						catchError((error) => {
							const errorMessage = this.getTranslation('ACTIVEPIECES_PAGE.CALLBACK.ERRORS.EXCHANGE_TOKEN') + ': ' + error.message;
							this._toastrService.error(errorMessage);
							this.loading = false;
							this._redirectToIntegrations();
							return EMPTY;
						})
					);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Create connection with access token and project ID
	 * Called after user submits project ID form
	 */
	createConnection() {
		if (this.form.invalid || !this.organization) {
			this._toastrService.error(this.getTranslation('ACTIVEPIECES_PAGE.CALLBACK.ERRORS.INVALID_PROJECT_ID'));
			return;
		}

		this.loading = true;
		const { projectId } = this.form.value;
		const accessToken = this._getStoredAccessToken();

		if (!accessToken) {
			this._toastrService.error(this.getTranslation('ACTIVEPIECES_PAGE.CALLBACK.ERRORS.TOKEN_NOT_FOUND'));
			this._redirectToIntegrations();
			return;
		}

		const { id: organizationId, tenantId } = this.organization;

		// Step 2: Create connection with access token
		// POST /integration/activepieces/connection
		this._activepiecesService
			.upsertConnection({
				accessToken,
				projectId,
				tenantId,
				organizationId
			})
			.pipe(
				tap((connection: IActivepiecesConnection) => {
					this._toastrService.success(this.getTranslation('ACTIVEPIECES_PAGE.CALLBACK.SUCCESS.CONNECTION_CREATED'));
					this._clearStoredAccessToken();
					this._redirectToActivepiecesIntegration(connection.integrationId);
				}),
				catchError((error) => {
					const errorMessage = this.getTranslation('ACTIVEPIECES_PAGE.CALLBACK.ERRORS.CREATE_CONNECTION') + ': ' + error.message;
					this._toastrService.error(errorMessage);
					this.loading = false;
					return EMPTY;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _storeAccessToken(accessToken: string): void {
		sessionStorage.setItem('activepieces_access_token', accessToken);
	}

	/**
	 * Get stored token response from sessionStorage
	 */
	private _getStoredAccessToken(): string | null {
		return sessionStorage.getItem('activepieces_access_token');
	}

	/**
	 * Clear stored token response from sessionStorage
	 */
	private _clearStoredAccessToken(): void {
		sessionStorage.removeItem('activepieces_access_token');
	}

	/**
	 * Redirect to integrations page
	 */
	private _redirectToIntegrations() {
		this._router.navigate(['/pages/integrations']);
	}

	/**
	 * Redirect to ActivePieces integration page
	 */
	private _redirectToActivepiecesIntegration(integrationId: string) {
		this._router.navigate(['/pages/integrations/activepieces', integrationId]);
	}

	ngOnDestroy(): void {}
}
