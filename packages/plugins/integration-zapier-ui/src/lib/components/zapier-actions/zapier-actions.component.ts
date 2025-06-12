import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import { tap, catchError, finalize, switchMap, distinctUntilChanged, map } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { ZapierService, ToastrService, Store } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';
import { IZapierEndpoint, IOrganization, ID } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-zapier-actions',
	templateUrl: './zapier-actions.component.html',
	styleUrls: ['./zapier-actions.component.scss'],
	standalone: false
})
export class ZapierActionsComponent extends TranslationBaseComponent implements OnInit {
	public loading = false;

	/** List of available Zapier actions/endpoints */
	public actions: IZapierEndpoint[] = [];

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
					this._loadActions();
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
	 * Loads Zapier actions using the integration ID from route parameters
	 * This method follows a simplified flow:
	 * 1. Use integration ID directly from route parameters
	 * 2. Retrieve stored OAuth token using integration ID
	 * 3. Fetch available Zapier actions using the token
	 */
	private _loadActions() {
		// Ensure we have an integration ID before proceeding
		if (!this.integrationId) {
			this._showNoIntegrationError();
			return;
		}

		this.loading = true;

		this._zapierService
			.getAccessToken(this.integrationId)
			.pipe(
				switchMap((accessToken: string) => this._zapierService.getActions(accessToken)),

				// Store the retrieved actions
				tap((actions: IZapierEndpoint[]) => {
					this.actions = actions;
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
							this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.ERRORS.LOAD_ACTIONS'),
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
	 * Open action details
	 */
	openActionDetails() {
		// TODO: Implement action details view
	}
}
