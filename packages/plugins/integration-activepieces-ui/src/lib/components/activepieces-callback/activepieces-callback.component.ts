import { Component, OnInit, OnDestroy } from '@angular/core';
import { UntypedFormGroup, UntypedFormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY } from 'rxjs';
import { tap, switchMap, filter, catchError } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IOrganization } from '@gauzy/contracts';
import { ActivepiecesService, Store, ToastrService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-activepieces-callback',
	templateUrl: './activepieces-callback.component.html',
	styleUrls: ['./activepieces-callback.component.scss'],
	standalone: false
})
export class ActivepiecesCallbackComponent implements OnInit, OnDestroy {
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
		private readonly _toastrService: ToastrService
	) {}

	ngOnInit() {
		this._store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
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
						this._toastrService.error('Invalid callback parameters');
						this._redirectToIntegrations();
						return EMPTY;
					}

					if (!this.organization) {
						this._toastrService.error('Organization not found');
						this._redirectToIntegrations();
						return EMPTY;
					}

					this.loading = true;

					// Step 1: Exchange authorization code for access token
					// POST /integration/activepieces/oauth/token
					return this._activepiecesService.exchangeToken({ code, state }).pipe(
						tap((tokenResponse) => {
							// Store token response temporarily
							this._storeTokenResponse(tokenResponse);
							// Show project ID form
							this.showProjectIdForm = true;
							this.loading = false;
						}),
						catchError((error) => {
							this._toastrService.error('Failed to exchange authorization code: ' + error.message);
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
			this._toastrService.error('Please provide a valid project ID');
			return;
		}

		this.loading = true;
		const { projectId } = this.form.value;
		const tokenResponse = this._getStoredTokenResponse();

		if (!tokenResponse || !tokenResponse.access_token) {
			this._toastrService.error('Token not found. Please try authorization again.');
			this._redirectToIntegrations();
			return;
		}

		const { id: organizationId, tenantId } = this.organization;

		// Step 2: Create connection with access token
		// POST /integration/activepieces/connection
		this._activepiecesService
			.upsertConnection({
				accessToken: tokenResponse.access_token,
				projectId,
				tenantId,
				organizationId
			})
			.pipe(
				tap((connection: any) => {
					this._toastrService.success('ActivePieces connection created successfully');
					this._clearStoredTokenResponse();
					this._redirectToActivepiecesIntegration(connection.integrationId);
				}),
				catchError((error) => {
					this._toastrService.error('Failed to create connection: ' + error.message);
					this.loading = false;
					return EMPTY;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Store token response in sessionStorage
	 */
	private _storeTokenResponse(tokenResponse: any): void {
		sessionStorage.setItem('activepieces_token_response', JSON.stringify(tokenResponse));
	}

	/**
	 * Get stored token response from sessionStorage
	 */
	private _getStoredTokenResponse(): any {
		const stored = sessionStorage.getItem('activepieces_token_response');
		return stored ? JSON.parse(stored) : null;
	}

	/**
	 * Clear stored token response from sessionStorage
	 */
	private _clearStoredTokenResponse(): void {
		sessionStorage.removeItem('activepieces_token_response');
	}

	/**
	 * Redirect to integrations page
	 */
	private _redirectToIntegrations() {
		this._router.navigate(['pages/integrations']);
	}

	/**
	 * Redirect to ActivePieces integration page
	 */
	private _redirectToActivepiecesIntegration(integrationId: string) {
		this._router.navigate(['pages/integrations/activepieces', integrationId]);
	}

	ngOnDestroy(): void {}
}
