import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { NbMenuItem, NbRouteTab } from '@nebular/theme';
import { filter } from 'rxjs/operators';
import { tap } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ID, IOrganization } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { Store } from '@gauzy/ui-core/core';

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

	constructor(
		private readonly _router: Router,
		public readonly translateService: TranslateService,
		private readonly _activatedRoute: ActivatedRoute,
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
				tap(() => this._loadMenus())
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
	 * Load tabs for Make.com integration
	 */
	private _loadTabs() {
		this.tabs = [
			{
				title: this.getTranslation('INTEGRATIONS.MAKE_PAGE.SCENARIOS'),
				icon: 'flash-outline',
				responsive: true,
				route: this.getRoute('scenarios')
			},
			{
				title: this.getTranslation('INTEGRATIONS.MAKE_PAGE.EXECUTIONS'),
				icon: 'activity-outline',
				responsive: true,
				route: this.getRoute('executions')
			},
			{
				title: this.getTranslation('INTEGRATIONS.MAKE_PAGE.HISTORY'),
				icon: 'clock-outline',
				responsive: true,
				route: this.getRoute('history')
			}
		];
	}

	/**
	 * Load menu items for Make.com integration
	 */
	private _loadMenus() {
		this.menus = [
			{
				title: this.getTranslation('INTEGRATIONS.RE_INTEGRATE'),
				icon: 'text-outline',
				link: `pages/integrations/make/regenerate`
			},
			{
				title: this.getTranslation('INTEGRATIONS.SETTINGS'),
				icon: 'settings-2-outline',
				link: `pages/integrations/make/${this.integrationId}/settings`
			}
		];
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

	ngOnDestroy(): void {}
}
