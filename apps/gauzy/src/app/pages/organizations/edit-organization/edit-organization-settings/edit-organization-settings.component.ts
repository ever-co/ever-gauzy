import { Component, OnInit, Input, AfterViewInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IOrganization } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { tap } from 'rxjs/operators';
import { PageTabRegistryConfig, PageTabRegistryService, PageTabsetPageId } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ngx-edit-organization-settings',
    templateUrl: './edit-organization-settings.component.html',
    styleUrls: ['./edit-organization-settings.component.scss'],
    standalone: false
})
export class EditOrganizationSettingsComponent extends TranslationBaseComponent implements AfterViewInit, OnInit {
	@Input() organization: IOrganization;

	// The identifier for the tabset, handed down by the route (see `edit-organization-routing.module.ts`)
	public tabsetId: PageTabsetPageId = this.route.snapshot.data.tabsetId;

	constructor(
		private readonly route: ActivatedRoute,
		public readonly translateService: TranslateService,
		private readonly _pageTabRegistryService: PageTabRegistryService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.route.params
			.pipe(
				tap(() => this._registerPageTabs()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this._applyTranslationOnTabs();
	}

	/**
	 * Constructs a route URL for a specific tab in the 'edit-organization' view.
	 *
	 * @param tab - The name of the tab for which to generate the route.
	 * @returns The complete route URL for the specified tab.
	 */
	getRoute(tab: string): string {
		return `/pages/organizations/edit/${this.route.snapshot.paramMap.get('id')}/${tab}`;
	}

	/**
	 * Registers the tabs for the 'organization-edit-page' page.
	 *
	 * The registry replaces any tab already registered under the same `tabId`, so this is
	 * safe to call again whenever the route parameters or the language change.
	 */
	private _registerPageTabs(): void {
		this._createTabsConfig().forEach((tab: PageTabRegistryConfig) =>
			this._pageTabRegistryService.registerPageTab(tab)
		);
	}

	/**
	 * Creates the configuration for the tabs used in the 'organization-edit-page' page.
	 *
	 * @returns An array of PageTabRegistryConfig objects.
	 */
	private _createTabsConfig(): PageTabRegistryConfig[] {
		return [
			{
				tabsetId: this.tabsetId,
				tabId: 'main',
				tabIcon: 'person-outline',
				tabsetType: 'route',
				tabTitle: (_i18n) => _i18n.getTranslation('ORGANIZATIONS_PAGE.MAIN'),
				order: 0,
				responsive: true,
				route: this.getRoute('main'),
				queryParamsHandling: 'merge'
			},
			{
				tabsetId: this.tabsetId,
				tabId: 'location',
				tabIcon: 'pin-outline',
				tabsetType: 'route',
				tabTitle: (_i18n) => _i18n.getTranslation('ORGANIZATIONS_PAGE.LOCATION'),
				order: 1,
				responsive: true,
				route: this.getRoute('location'),
				queryParamsHandling: 'merge'
			},
			{
				tabsetId: this.tabsetId,
				tabId: 'settings',
				tabIcon: 'settings-outline',
				tabsetType: 'route',
				tabTitle: (_i18n) => _i18n.getTranslation('ORGANIZATIONS_PAGE.SETTINGS'),
				order: 2,
				responsive: true,
				route: this.getRoute('settings'),
				queryParamsHandling: 'merge'
			}
		];
	}

	/**
	 * Re-registers the tabs when the language changes, so their titles follow it.
	 */
	private _applyTranslationOnTabs(): void {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._registerPageTabs()),
				untilDestroyed(this)
			)
			.subscribe();
	}
}
