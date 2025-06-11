import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import { tap, catchError, finalize, switchMap, map, distinctUntilChanged } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { ZapierService, ToastrService, Store } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';
import { IZapierWebhook, IOrganization, ID } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-zapier-webhooks',
	templateUrl: './zapier-webhooks.component.html',
	styleUrls: ['./zapier-webhooks.component.scss'],
	standalone: false
})
export class ZapierWebhooksComponent extends TranslationBaseComponent implements OnInit {
	public loading = false;

	/** List of available Zapier webhooks */
	public webhooks: IZapierWebhook[] = [];

	/** Current organization data */
	public organization: IOrganization | null = null;

	/** Zapier integration ID from route parameters */
	public integrationId: ID | null = null;

	constructor(
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _store: Store,
		public readonly translateService: TranslateService,
		private readonly _zapierService: ZapierService,
		private readonly _toastrService: ToastrService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		// Subscribe to route parameters to get integration ID
		const parentRoute = this._activatedRoute.parent;
		if (!parentRoute) {
			this._showNoIntegrationError();
			return;
		}

		parentRoute.params
			.pipe(
				map((p: Params) => p['id']),
				distinctUntilChanged(),
				tap((id: ID) => {
					this.integrationId = id;
					this._loadWebhooks();
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
	 * Loads Zapier webhooks using the integration ID from route parameters
	 * This method follows a simplified flow:
	 * 1. Use integration ID directly from route parameters
	 * 2. Retrieve stored OAuth token using integration ID
	 * 3. Fetch available Zapier webhooks using the token
	 */
	private _loadWebhooks() {
		// Ensure we have an integration ID before proceeding
		if (!this.integrationId) {
			this._showNoIntegrationError();
			return;
		}

		this.loading = true;

		// Step 1: Get stored OAuth token using integration ID from route
		this._zapierService
			.getAccessToken(this.integrationId)
			.pipe(
				switchMap((accessToken: string) => this._zapierService.getWebhooks(accessToken)),
				// Store the retrieved webhooks
				tap((webhooks: IZapierWebhook[]) => {
					this.webhooks = webhooks;
				}),
				// Handle specific error cases
				catchError((error) => {
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
							this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.ERRORS.LOAD_WEBHOOKS'),
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
	 * Delete a webhook by ID
	 */
	deleteWebhook(webhookId: string) {
		// Ensure we have an integration ID before proceeding
		if (!this.integrationId) {
			this._showNoIntegrationError();
			return;
		}

		// Get stored OAuth token using integration ID from route
		this._zapierService
			.getAccessToken(this.integrationId)
			.pipe(
				switchMap((accessToken: string) => this._zapierService.deleteWebhook(webhookId, accessToken)),

				tap(() => {
					this._toastrService.success(
						this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.SUCCESS.DELETE_WEBHOOK'),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
					// Reload webhooks after successful deletion
					this._loadWebhooks();
				}),
				catchError((error) => {
					// Handle different types of errors with specific messages
					if (error.status === 404 || error.message?.includes('not found')) {
						this._toastrService.error(
							this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.ERRORS.WEBHOOK_NOT_FOUND'),
							this.getTranslation('TOASTR.TITLE.ERROR')
						);
					} else if (error.status === 401 || error.message?.includes('access token')) {
						this._toastrService.error(
							this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.ERRORS.INVALID_TOKEN'),
							this.getTranslation('TOASTR.TITLE.ERROR')
						);
					} else {
						this._toastrService.error(
							this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.ERRORS.DELETE_WEBHOOK'),
							this.getTranslation('TOASTR.TITLE.ERROR')
						);
					}

					return EMPTY;
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
}
