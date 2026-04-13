import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { NbMenuItem, NbRouteTab } from '@nebular/theme';
import { filter, finalize } from 'rxjs/operators';
import { tap, catchError, EMPTY } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ID, IOrganization, IntegrationEnum } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { Store, IntegrationsService, MakeComStoreService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-make',
	templateUrl: './make.component.html',
	standalone: false
})
export class MakeComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public tabs: NbRouteTab[] = [];
	public menus: NbMenuItem[] = [];
	public integrationId: ID;
	public organization: IOrganization;
	public loading: boolean = false;
	private readonly BASE_MENU_ROUTE = 'pages/integrations/makecom';

	constructor(
		private readonly _router: Router,
		public readonly translateService: TranslateService,
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _store: Store,
		private readonly _integrationsService: IntegrationsService,
		private readonly _makeComStoreService: MakeComStoreService
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

	getRoute(tabName: string) {
		return `./${tabName}`;
	}

	private _loadTabs() {
		this.tabs = [
			{
				title: this.getTranslation('INTEGRATIONS.MAKE_COM_PAGE.SCENARIOS'),
				icon: 'flash-outline',
				responsive: true,
				route: this.getRoute('scenarios')
			},
			{
				title: this.getTranslation('INTEGRATIONS.MAKE_COM_PAGE.WEBHOOKS'),
				icon: 'link-2-outline',
				responsive: true,
				route: this.getRoute('hooks')
			},
			{
				title: this.getTranslation('INTEGRATIONS.MAKE_COM_PAGE.CONNECTIONS'),
				icon: 'swap-outline',
				responsive: true,
				route: this.getRoute('connections')
			},
			{
				title: this.getTranslation('INTEGRATIONS.MAKE_COM_PAGE.TEMPLATES'),
				icon: 'file-text-outline',
				responsive: true,
				route: this.getRoute('templates')
			},
			{
				title: this.getTranslation('INTEGRATIONS.MAKE_COM_PAGE.SETTINGS'),
				icon: 'settings-2-outline',
				responsive: true,
				route: this.getRoute('settings')
			}
		];
	}

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

	private _loadIntegrationSettings() {
		if (!this.organization) return;

		this.loading = true;
		const { id: organizationId, tenantId } = this.organization;

		this._integrationsService
			.getIntegrationByOptions({
				name: IntegrationEnum.MakeCom,
				organizationId,
				tenantId
			})
			.pipe(
				tap((integration) => {
					if (integration) {
						this._makeComStoreService.loadIntegrationSettings().subscribe();
					}
				}),
				catchError((error) => {
					console.error('Error loading Make.com integration settings:', error);
					return EMPTY;
				}),
				untilDestroyed(this)
			)
			.pipe(finalize(() => (this.loading = false)))
			.subscribe();
	}

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

	navigateToIntegrations(): void {
		this._router.navigate(['/pages/integrations']);
	}

	ngOnDestroy(): void {
		this._makeComStoreService.clearStore();
	}
}
