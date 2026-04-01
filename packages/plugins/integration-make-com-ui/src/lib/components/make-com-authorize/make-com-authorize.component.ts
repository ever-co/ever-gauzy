import { Component, OnInit } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { tap, catchError, filter } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { MakeComService, ToastrService, Store } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';
import { IOrganization, IIntegrationTenant, IntegrationEnum } from '@gauzy/contracts';
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
	public loading = false;
	public organization: IOrganization;
	public rememberState: boolean;
	private static readonly MAKE_DASHBOARD_ROUTE = '/pages/integrations/makecom';

	constructor(
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
		this._loadOrganization();
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
	 * Start OAuth authorization flow.
	 * No credentials needed — server uses its own env-configured client_id/secret.
	 */
	connectToMakeCom() {
		if (!this.organization) {
			this._toastrService.error(
				this.getTranslation('INTEGRATIONS.MAKE_COM_PAGE.ERRORS.NO_ORGANIZATION'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
			return;
		}

		this.loading = true;

		this._makeComService
			.initializeIntegration({ organizationId: this.organization.id })
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
					this.loading = false;
					return EMPTY;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Redirect to Make.com dashboard
	 */
	private _redirectToMakeDashboard(integrationId: string) {
		this._router.navigate([AuthorizationComponent.MAKE_DASHBOARD_ROUTE, integrationId]);
	}
}
