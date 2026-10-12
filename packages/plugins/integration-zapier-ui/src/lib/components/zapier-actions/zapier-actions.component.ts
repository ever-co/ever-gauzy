import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import { tap, catchError, finalize, switchMap, distinctUntilChanged, map } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { ZapierService, ToastrService, Store } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { IRecordViewSection } from '@gauzy/ui-core/shared';
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

	/*
	 * Read-only View: an action is a tiny record (endpoint metadata), so it
	 * opens in the right-side drawer rather than on a page of its own.
	 */
	public viewedAction: IZapierEndpoint | null = null;
	public viewSections: IRecordViewSection[] = [];

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

		// The list is about to be reloaded, so whatever the drawer is showing is
		// about to go stale — close it rather than leave a detached record open.
		this.closeView();

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
	 * Opens the read-only View of an action in the right-side drawer.
	 *
	 * @param action - The action row the action was invoked from.
	 */
	openActionDetails(action: IZapierEndpoint): void {
		if (!action) {
			return;
		}

		this.viewSections = this.buildViewSections();
		this.viewedAction = action;
	}

	closeView(): void {
		this.viewedAction = null;
	}

	/**
	 * Field descriptor for the drawer — the list row fields first, then the
	 * identifiers Zapier reports for the endpoint.
	 */
	private buildViewSections(): IRecordViewSection[] {
		return [
			{
				fields: [
					{ label: 'SM_TABLE.NAME', key: 'name' },
					{ label: 'SM_TABLE.DESCRIPTION', key: 'description', type: 'multiline', wide: true },
					// The record's raw UUID adds nothing a user can act on, and no generic
					// ID label key exists — the slug is the endpoint's real identifier.
					{ label: 'FORM.PLACEHOLDERS.CODE', key: 'slug' }
				]
			}
		];
	}
}
