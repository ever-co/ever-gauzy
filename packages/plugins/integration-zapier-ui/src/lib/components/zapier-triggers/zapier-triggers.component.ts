import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import { tap, catchError, finalize, switchMap } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { ZapierService, ToastrService, Store } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';
import { IZapierEndpoint, IOrganization, ID, IIntegrationSetting } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-zapier-triggers',
	templateUrl: './zapier-triggers.component.html',
	styleUrls: ['./zapier-triggers.component.scss'],
	standalone: false
})
export class ZapierTriggersComponent extends TranslationBaseComponent implements OnInit {
	public loading = false;

	/** List of available Zapier triggers/endpoints */
	public triggers: IZapierEndpoint[] = [];

	/** Current organization data */
	public organization: IOrganization;

	/** Zapier integration ID from route parameters */
	public integrationId: ID;

	constructor(
		private readonly _zapierService: ZapierService,
		private readonly _toastrService: ToastrService,
		private readonly _store: Store,
		private readonly _activatedRoute: ActivatedRoute,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		// Subscribe to route parameters to get integration ID
		this._activatedRoute.params
			.pipe(
				tap((params: Params) => {
					this.integrationId = params['id'];
				}),
				tap(() => {
					// Load triggers once we have the integration ID
					this._loadTriggers();
				}),
				untilDestroyed(this)
			)
			.subscribe();

		// Subscribe to organization changes
		this._store.selectedOrganization$
			.pipe(
				tap((organization: IOrganization) => {
					this.organization = organization;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Loads Zapier triggers using the integration ID from route parameters
	 * This method follows a simplified flow:
	 * 1. Use integration ID directly from route parameters
	 * 2. Retrieve stored OAuth token using integration ID
	 * 3. Fetch available Zapier triggers using the token
	 */
	private _loadTriggers() {
		// Ensure we have an integration ID before proceeding
		if (!this.integrationId) {
			console.warn('No integration ID available from route parameters');
			this._showNoIntegrationError();
			return;
		}

		this.loading = true;

		// Step 1: Get stored OAuth token using integration ID from route
		this._zapierService
			.getZapierToken(this.integrationId)
			.pipe(
				// Step 2: Extract access token from integration setting
				switchMap((integrationSetting: IIntegrationSetting) => {
					if (!integrationSetting || !integrationSetting.settingsValue) {
						throw new Error('Integration setting found but access token value is missing');
					}

					// Parse the access token from the settings value
					let accessToken: string;
					try {
						// If settingsValue is a JSON string, parse it
						const tokenData =
							typeof integrationSetting.settingsValue === 'string'
								? JSON.parse(integrationSetting.settingsValue)
								: integrationSetting.settingsValue;

						accessToken = tokenData.access_token || tokenData;
					} catch (parseError) {
						// If parsing fails, treat as direct token string
						accessToken = integrationSetting.settingsValue as string;
					}

					if (!accessToken) {
						throw new Error('Access token is empty or invalid');
					}

					return this._zapierService.getTriggers(accessToken);
				}),
				// Store the retrieved triggers
				tap((triggers: IZapierEndpoint[]) => {
					this.triggers = triggers;
					console.log(`Successfully loaded ${triggers.length} Zapier triggers`);
				}),
				// Handle specific error cases
				catchError((error) => {
					console.error('Error loading Zapier triggers:', error);

					// Handle different types of errors with specific messages
					if (error.status === 404 || error.message?.includes('not found')) {
						this._toastrService.error(
							this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.ERRORS.TOKEN_NOT_FOUND'),
							this.getTranslation('TOASTR.TITLE.ERROR')
						);
					} else if (error.status === 401 || error.message?.includes('access token')) {
						this._toastrService.error(
							this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.ERRORS.INVALID_TOKEN'),
							this.getTranslation('TOASTR.TITLE.ERROR')
						);
					} else {
						this._toastrService.error(
							this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.ERRORS.LOAD_TRIGGERS'),
							this.getTranslation('TOASTR.TITLE.ERROR')
						);
					}

					return EMPTY;
				}),
				// Ensure loading state is always reset
				finalize(() => {
					this.loading = false;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Show error message when no integration ID is available
	 */
	private _showNoIntegrationError() {
		this._toastrService.error(
			this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.ERRORS.NO_INTEGRATION_ID'),
			this.getTranslation('TOASTR.TITLE.ERROR')
		);
	}

	/**
	 * Open trigger details
	 */
	openTriggerDetails() {
		// TODO: Implement trigger details view
	}
}
