import { Component, OnInit, Input, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { NbRouteTab } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { tap } from 'rxjs/operators';
import { Subject } from 'rxjs/internal/Subject';
import { PageTabRegistryConfig, PageTabRegistryService, PageTabsetRegistryId } from '@gauzy/ui-core/core';

@UntilDestroy()
@Component({
	selector: 'gz-dynamic-tabs',
	templateUrl: './dynamic-tabs.component.html',
	styleUrls: ['./dynamic-tabs.component.scss'],
	providers: []
})
export class DynamicTabsComponent implements OnInit, OnDestroy {
	public tabs: NbRouteTab[] = []; // Define the structure of tabs according to your needs
	public reload$ = new Subject<boolean>(); // Subject to trigger reload of tabs

	@Input() tabsetId!: PageTabsetRegistryId;

	/**
	 * Determines if all tabs in the tabset have the tabsetType set to 'route'.
	 *
	 * @returns true if all tabs in the tabset have tabsetType set to 'route', false otherwise.
	 */
	get isRouterTabset(): boolean {
		const tabs = this.getRegisteredTabs(this.tabsetId);

		// If there are no tabs or tabs is undefined, assume it's not a router tabset.
		if (!tabs || tabs.length === 0) {
			return false;
		}

		// Check if every tab has tabsetType set to 'route'
		return tabs.every((tab) => tab.tabsetType === 'route');
	}

	constructor(
		private readonly _cdr: ChangeDetectorRef,
		private readonly _pageTabRegistryService: PageTabRegistryService,
		private readonly _translateService: TranslateService
	) {}

	ngOnInit(): void {
		this._initializeTabs();
		this._applyTranslationOnTabs();
		this._setupReloadTabsListener();
	}

	/**
	 * Setup listener for reloading tabs.
	 */
	private _setupReloadTabsListener(): void {
		this.reload$
			.pipe(
				tap(() => this._initializeTabs()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Initializes the tabs for the component based on the provided tabset ID.
	 *
	 * This function retrieves all registered tabs for the specified tabset ID
	 * using the `getRegisteredNbTabs` method and assigns them to the `tabs`
	 * property. This allows the component to display the correct set of tabs
	 * dynamically.
	 */
	private _initializeTabs(): void {
		// Retrieve and set the tabs based on the tabsetId
		this.tabs = this.getRegisteredNbTabs(this.tabsetId);
		this._cdr.detectChanges();
	}

	/**
	 * Retrieve and filter tabs for a specified tabset.
	 *
	 * @param tabsetId The identifier for the tabset.
	 * @returns An array of PageTabRegistryConfig objects for the specified tabset, excluding tabs with hide set to true.
	 */
	private getRegisteredTabs(tabsetId: PageTabsetRegistryId): PageTabRegistryConfig[] {
		return this._pageTabRegistryService.getPageTabset(tabsetId).filter((tab: PageTabRegistryConfig) => !tab.hide);
	}

	/**
	 * Get all registered tabs for a specified tabset.
	 *
	 * This function retrieves the registered tabs from the PageTabRegistryService
	 * and maps each tab configuration to an NbRouteTab object, which can be used
	 * by the Nebular tabset component. The title is translated if necessary,
	 * and other properties like icon, disabled state, responsive behavior, and route
	 * are mapped accordingly.
	 *
	 * @param tabsetId The identifier for the tabset.
	 * @returns An array of NbRouteTab objects representing the registered tabs.
	 */
	getRegisteredNbTabs(tabsetId: PageTabsetRegistryId): NbRouteTab[] {
		// Map each tab configuration to an NbRouteTab object
		return this.getRegisteredTabs(tabsetId).map((tab: PageTabRegistryConfig): NbRouteTab => {
			// Create a new route object
			const route: NbRouteTab = {
				...(tab.tabTitle && {
					title: typeof tab.tabTitle === 'function' ? tab.tabTitle() : tab.tabTitle
				}),
				...(tab.route && { route: tab.route }),
				...(tab.tabIcon && { icon: tab.tabIcon }),
				...(tab.responsive && { responsive: tab.responsive }),
				...(tab.activeLinkOptions && { activeLinkOptions: tab.activeLinkOptions }),
				disabled: !!tab.disabled
			};

			// Return the route object
			return route;
		});
	}

	/**
	 * Applies translations to dynamic tabs.
	 *
	 * This function listens for language change events and re-initializes the tabs
	 * when the language changes. This ensures that the tabs are always displayed
	 * in the correct language.
	 */
	private _applyTranslationOnTabs(): void {
		// Listen for language change events from the translation service
		this._translateService.onLangChange
			.pipe(
				// Re-initialize the tabs when the language changes
				tap(() => this._initializeTabs()),
				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Create dynamic components for the tabs
	 */
	createDynamicComponents(): void {
		// Add logic to create dynamic components for the tabset
	}

	/**
	 * Create static tabs for the tabset
	 */
	createStaticTabs(): void {
		// Add logic to create static tabs for NbTabsetComponent if necessary
	}

	ngOnDestroy(): void {}
}
