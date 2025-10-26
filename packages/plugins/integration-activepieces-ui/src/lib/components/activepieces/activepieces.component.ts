import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { NbMenuItem, NbRouteTab } from '@nebular/theme';
import { filter, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ID, IOrganization } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { Store, ActivepiecesStoreService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-activepieces',
	templateUrl: './activepieces.component.html',
	standalone: false
})
export class ActivepiecesComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public tabs: NbRouteTab[] = [];
	public menus: NbMenuItem[] = [];
	public integrationId!: ID;
	public organization!: IOrganization;

	constructor(
		private readonly _router: Router,
		public override readonly translateService: TranslateService,
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _activepiecesStore: ActivepiecesStoreService,
		private readonly _store: Store
	) {
		super(translateService);
	}

	ngOnInit() {
		this._loadTabs();
		this._applyTranslationOnTabsActions();

		this._activatedRoute.params
			.pipe(
				tap((params: Params) => (this.integrationId = params['id'])),
				tap(() => this._activepiecesStore.setSelectedIntegrationId(this.integrationId)),
				tap(() => this._loadMenus()),
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
	 * Get route for tabs
	 */
	getRoute(tabName: string) {
		return `./${tabName}`;
	}

	/**
	 * Load navigation tabs
	 */
	private _loadTabs() {
		this.tabs = [
			{
				title: this.getTranslation('INTEGRATIONS.ACTIVEPIECES_PAGE.CONNECTIONS.TITLE'),
				icon: 'link-2-outline',
				responsive: true,
				route: this.getRoute('connections')
			},
			{
				title: this.getTranslation('INTEGRATIONS.ACTIVEPIECES_PAGE.MCP_SERVERS.TITLE'),
				icon: 'swap-outline',
				responsive: true,
				route: this.getRoute('mcp-servers')
			}
		];
	}

	/**
	 * Load context menu items
	 */
	private _loadMenus() {
		this.menus = [
			{
				title: this.getTranslation('INTEGRATIONS.RE_INTEGRATE'),
				icon: 'text-outline',
				link: `/pages/integrations/activepieces/regenerate`
			},
			{
				title: this.getTranslation('INTEGRATIONS.SETTINGS'),
				icon: 'settings-2-outline',
				link: `/pages/integrations/activepieces/${this.integrationId}/settings`
			}
		];
	}

	/**
	 * Apply translation on tabs and menus when language changes
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
	 * Navigate to integrations page
	 */
	navigateToIntegrations(): void {
		this._router.navigate(['/pages/integrations']);
	}

	ngOnDestroy(): void {}
}
