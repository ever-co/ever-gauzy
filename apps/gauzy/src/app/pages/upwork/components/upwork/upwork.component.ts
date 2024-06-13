import { Component, OnInit, OnDestroy } from '@angular/core';
import { NbMenuItem } from '@nebular/theme';
import { filter } from 'rxjs/operators';
import { tap } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { IOrganization } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { Store } from '@gauzy/ui-core/common';
import { UpworkStoreService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-upwork',
	templateUrl: './upwork.component.html'
})
export class UpworkComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	tabs: any[];
	supportContextActions: NbMenuItem[];
	integrationId: string;
	organization: IOrganization;

	constructor(
		private readonly _router: Router,
		public readonly translateService: TranslateService,
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _upworkStore: UpworkStoreService,
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
				tap(() => this._loadActions())
			)
			.subscribe();
		this._store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this._getConfig()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _getConfig() {
		const { tenantId } = this._store.user;
		const { id: organizationId } = this.organization;
		const integrationId = this.integrationId;
		this._upworkStore.getConfig({ integrationId, organizationId, tenantId }).pipe(untilDestroyed(this)).subscribe();
	}

	getRoute(tabName: string) {
		return `./${tabName}`;
	}

	private _loadTabs() {
		this.tabs = [
			{
				title: this.getTranslation('INTEGRATIONS.UPWORK_PAGE.ACTIVITIES'),
				icon: 'trending-up-outline',
				responsive: true,
				route: this.getRoute('activities')
			},
			{
				title: this.getTranslation('INTEGRATIONS.UPWORK_PAGE.REPORTS'),
				icon: 'file-text-outline',
				responsive: true,
				route: this.getRoute('reports')
			},
			{
				title: this.getTranslation('INTEGRATIONS.UPWORK_PAGE.TRANSACTIONS'),
				icon: 'flip-outline',
				responsive: true,
				route: this.getRoute('transactions')
			},
			{
				title: this.getTranslation('INTEGRATIONS.UPWORK_PAGE.CONTRACTS'),
				icon: 'book-outline',
				responsive: true,
				route: this.getRoute('contracts')
			}
		];
	}

	private _loadActions() {
		this.supportContextActions = [
			{
				title: this.getTranslation('INTEGRATIONS.RE_INTEGRATE'),
				icon: 'text-outline',
				link: `pages/integrations/upwork/regenerate`
			},
			{
				title: this.getTranslation('INTEGRATIONS.SETTINGS'),
				icon: 'settings-2-outline',
				link: `pages/integrations/upwork/${this.integrationId}/settings`
			}
		];
	}

	private _applyTranslationOnTabsActions() {
		this.translateService.onLangChange
			.pipe(
				tap(() => {
					this._loadTabs();
					this._loadActions();
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy(): void {}

	/**
	 * Navigate to the "Integrations" page.
	 */
	navigateToIntegrations(): void {
		this._router.navigate(['/pages/integrations']);
	}
}
