import { Component, OnInit, inject, ChangeDetectionStrategy, signal, WritableSignal } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { NbMenuItem, NbRouteTab } from '@nebular/theme';
import { filter } from 'rxjs/operators';
import { tap } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ID, IOrganization } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { Store, UpworkStoreService } from '@gauzy/ui-core/core';

@UntilDestroy()
@Component({
	selector: 'ngx-upwork',
	templateUrl: './upwork.component.html',
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class UpworkComponent extends TranslationBaseComponent implements OnInit {
	private readonly _router = inject(Router);
	private readonly _activatedRoute = inject(ActivatedRoute);
	private readonly _upworkStore = inject(UpworkStoreService);
	private readonly _store = inject(Store);

	protected tabs: WritableSignal<NbRouteTab[]> = signal<NbRouteTab[]>([]);
	protected menus: WritableSignal<NbMenuItem[]> = signal<NbMenuItem[]>([]);
	protected integrationId: WritableSignal<ID | undefined> = signal<ID | undefined>(undefined);
	protected organization: WritableSignal<IOrganization | undefined> = signal<IOrganization | undefined>(undefined);

	constructor() {
		super(inject(TranslateService));
	}

	ngOnInit() {
		this._loadTabs();
		this._applyTranslationOnTabsActions();

		this._activatedRoute.params
			.pipe(
				tap((params: Params) => {
					this.integrationId.set(params['id']);
				}),
				tap(() => this._loadMenus()),
				untilDestroyed(this)
			)
			.subscribe();
		this._store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				tap((organization: IOrganization) => {
					this.organization.set(organization);
				}),
				tap(() => this._getConfig()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 *
	 */
	private _getConfig() {
		const { id: organizationId, tenantId } = this.organization();
		const integrationId = this.integrationId();
		this._upworkStore.getConfig({ integrationId, organizationId, tenantId }).pipe(untilDestroyed(this)).subscribe();
	}

	/**
	 *
	 * @param tabName
	 * @returns
	 */
	getRoute(tabName: string) {
		return `./${tabName}`;
	}

	/**
	 *
	 */
	private _loadTabs() {
		this.tabs.set([
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
		]);
	}

	/**
	 *
	 */
	private _loadMenus() {
		this.menus.set([
			{
				title: this.getTranslation('INTEGRATIONS.RE_INTEGRATE'),
				icon: 'text-outline',
				link: `pages/integrations/upwork/regenerate`
			},
			{
				title: this.getTranslation('INTEGRATIONS.SETTINGS'),
				icon: 'settings-2-outline',
				link: `pages/integrations/upwork/${this.integrationId()}/settings`
			}
		]);
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

	/**
	 * Navigate to the "Integrations" page.
	 */
	navigateToIntegrations(): void {
		this._router.navigate(['/pages/integrations']);
	}
}
