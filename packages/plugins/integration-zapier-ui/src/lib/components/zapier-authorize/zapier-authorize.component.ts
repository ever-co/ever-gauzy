import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { tap, catchError, finalize, switchMap } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { ZapierService, ToastrService, IntegrationsService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';
import { IntegrationEnum, IOrganization } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-zapier-authorize',
	templateUrl: './zapier-authorize.component.html',
	styleUrls: ['./zapier-authorize.component.scss'],
	standalone: false
})
export class ZapierAuthorizeComponent extends TranslationBaseComponent implements OnInit {
	public loading = false;
	public organization: IOrganization;

	constructor(
		private readonly _zapierService: ZapierService,
		private readonly _toastrService: ToastrService,
		private readonly _router: Router,
		private readonly _store: Store,
		private readonly _integrationsService: IntegrationsService,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._loadOrganization()
			.pipe(
				switchMap(() => this._checkExistingIntegration()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _loadOrganization() {
		return this._store.selectedOrganization$.pipe(
			tap((organization) => {
				this.organization = organization;
			})
		);
	}

	private _checkExistingIntegration() {
		if (!this.organization) return EMPTY;

		const { id: organizationId, tenantId } = this.organization;

		return this._integrationsService
			.getIntegrationByOptions({
				name: IntegrationEnum.ZAPIER,
				organizationId,
				tenantId
			})
			.pipe(
				tap((integration) => {
					if (integration) {
						this._router.navigate(['/pages/integrations/zapier', integration.id]);
					}
				}),
				catchError((error) => {
					console.error('Error checking existing integration:', error);
					return EMPTY;
				}),
				finalize(() => {
					this.loading = false;
				})
			);
	}

	/**
	 * Start OAuth authorization flow.
	 * No credentials needed — server uses its own env-configured client_id/secret.
	 */
	connectToZapier() {
		if (!this.organization) {
			this._toastrService.error(
				this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.ERRORS.NO_ORGANIZATION'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
			return;
		}

		this.loading = true;

		this._zapierService
			.initializeIntegration({ organizationId: this.organization.id })
			.pipe(
				tap((response: { authorizationUrl: string }) => {
					// Redirect to Zapier's OAuth consent page
					window.location.href = response.authorizationUrl;
				}),
				catchError((error) => {
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.ERRORS.START_AUTHORIZATION'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					console.error('Error starting authorization:', error);
					return EMPTY;
				}),
				finalize(() => {
					this.loading = false;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}
}
