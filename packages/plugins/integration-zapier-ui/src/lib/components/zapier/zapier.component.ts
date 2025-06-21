import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { NbMenuItem, NbRouteTab } from '@nebular/theme';
import { filter, finalize } from 'rxjs/operators';
import { tap, catchError, EMPTY } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ID, IOrganization, IntegrationEnum } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { Store, IntegrationsService, ZapierStoreService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-zapier',
	templateUrl: './zapier.component.html',
	styleUrls: ['./zapier.component.scss'],
	standalone: false
})
export class ZapierComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public tabs: NbRouteTab[] = [];
	public menus: NbMenuItem[] = [];
	public integrationId: ID;
	public organization: IOrganization;
	public loading = false;
	private readonly BASE_MENU_ROUTE = 'pages/integrations/zapier';

	constructor(
		private readonly _router: Router,
		public readonly translateService: TranslateService,
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _store: Store,
		private readonly _integrationsService: IntegrationsService,
		private readonly _zapierStoreService: ZapierStoreService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._loadTabs();
		this._applyTranslationOnTabsActions();

		this._activatedRoute.params
			.pipe(
				tap((params: Params) => (this.integrationId = params['id'])),
				tap(() => this._loadMenus()),
				tap(() => this._loadIntegrationSettings()),
				untilDestroyed(this)
			)
			.subscribe();

		this._store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Get route for tab navigation
	 */
	getRoute(tabName: string) {
		return `./${tabName}`;
	}

	/**
	 * Load tabs for Zapier integration
	 */
	private _loadTabs() {
		this.tabs = [
			{
				title: this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.TAB.TRIGGERS'),
				icon: 'flash-outline',
				responsive: true,
				route: this.getRoute('triggers')
			},
			{
				title: this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.TAB.ACTIONS'),
				icon: 'activity-outline',
				responsive: true,
				route: this.getRoute('actions')
			},
			{
				title: this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.TAB.WEBHOOKS'),
				icon: 'link-outline',
				responsive: true,
				route: this.getRoute('webhooks')
			},
			{
				title: this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.TAB.SETTINGS'),
				icon: 'settings-2-outline',
				responsive: true,
				route: this.getRoute('settings')
			}
		];
	}

	/**
	 * Load menu items for Zapier integration
	 */
	private _loadMenus() {
		this.menus = [
			{
				title: this.getTranslation('INTEGRATIONS.RE_INTEGRATE'),
				icon: 'text-outline',
				link: `${this.BASE_MENU_ROUTE}/regenerate`
			},
			{
				title: this.getTranslation('INTEGRATIONS.SETTINGS'),
				icon: 'settings-2-outline',
				link: `${this.BASE_MENU_ROUTE}/${this.integrationId}/settings`
			}
		];
	}

	/**
	 * Load integration settings
	 */
	private _loadIntegrationSettings() {
		if (!this.organization) return;

		this.loading = true;
		const { id: organizationId, tenantId } = this.organization;

		this._integrationsService
			.getIntegrationByOptions({
				name: IntegrationEnum.ZAPIER,
				organizationId,
				tenantId
			})
			.pipe(
				tap((integration) => {
					if (integration) {
						this._zapierStoreService.reset();
					}
				}),
				catchError(() => {
					return EMPTY;
				}),
				untilDestroyed(this)
			)
			.pipe(finalize(() => (this.loading = false)))
			.subscribe();
	}

	/**
	 * Apply translations when language changes
	 */
	private _applyTranslationOnTabsActions() {
		this.translateService.onLangChange
			.pipe(
				tap(() => {
					this._loadTabs();
					this._loadMenus();
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Navigate to the "Integrations" page
	 */
	navigateToIntegrations(): void {
		this._router.navigate(['/pages/integrations']);
	}

	ngOnDestroy(): void {
		this._zapierStoreService.reset();
	}
}
