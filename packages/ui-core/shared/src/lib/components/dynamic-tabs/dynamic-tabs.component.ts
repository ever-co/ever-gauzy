import {
	Component,
	OnInit,
	Input,
	OnDestroy,
	ChangeDetectorRef,
	ViewContainerRef,
	Type,
	TemplateRef,
	ViewChildren,
	QueryList
} from '@angular/core';
import { NbRouteTab } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { tap } from 'rxjs/operators';
import { Subject } from 'rxjs/internal/Subject';
import {
	CustomNbRouteTab,
	PageTabRegistryConfig,
	PageTabRegistryService,
	PageTabsetRegistryId
} from '@gauzy/ui-core/core';
import { I18nService } from '@gauzy/ui-core/i18n';

@UntilDestroy()
@Component({
    selector: 'gz-dynamic-tabs',
    templateUrl: './dynamic-tabs.component.html',
    styleUrls: ['./dynamic-tabs.component.scss'],
    providers: [],
    standalone: false
})
export class DynamicTabsComponent implements OnInit, OnDestroy {
	public tabs: CustomNbRouteTab[] = []; // Define the structure of tabs according to your needs
	public reload$ = new Subject<boolean>(); // Subject to trigger reload of tabs

	// Input to set the tabsetId
	@Input() tabsetId!: PageTabsetRegistryId;

	// ViewChildren to access the tab content containers
	@ViewChildren('tabContent', { read: ViewContainerRef }) tabContents!: QueryList<ViewContainerRef>;

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
		private readonly _translateService: TranslateService,
		private readonly _pageTabRegistryService: PageTabRegistryService,
		readonly _i18n: I18nService
	) {}

	ngOnInit(): void {
		this._initializeTabs();
		this._applyTranslationOnTabs();
		this._setupReloadTabsListener();
	}

	ngAfterViewInit(): void {
		this._loadTabsContent(); // Load the tab content for each tab in the tabset
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
	 * Load the tab content for each tab in the tabset.
	 */
	private _loadTabsContent(): void {
		// Load the tab content for each tab in the tabset
		this.tabContents.forEach((container: ViewContainerRef, index: number) => {
			// Get the tab configuration for the current index
			const tab = this.tabs[index];

			// Get the component or template for the tab
			const content = this._pageTabRegistryService.getComponentOrTemplateForTab(this.tabsetId, tab.tabId);

			// Check if the content is a template or component
			if (content instanceof TemplateRef) {
				this.loadTemplateForTab(content, container); // Handle template loading
			} else if (content instanceof Type) {
				this.loadComponentForTab(content, container); // Handle component loading
			}
		});

		// Detect changes after loading tab content
		this._cdr.detectChanges();
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
	getRegisteredNbTabs(tabsetId: PageTabsetRegistryId): CustomNbRouteTab[] {
		// Map each tab configuration to an NbRouteTab object
		return this.getRegisteredTabs(tabsetId).map((tab: PageTabRegistryConfig): NbRouteTab => {
			// Create a new route tab object
			const route: CustomNbRouteTab = {
				...(tab.tabTitle && {
					title: typeof tab.tabTitle === 'function' ? tab.tabTitle(this._i18n) : tab.tabTitle
				}),
				...(tab.tabId && { tabId: tab.tabId }),
				...(tab.route && { route: tab.route }),
				...(tab.tabIcon && { icon: tab.tabIcon }),
				...(tab.responsive && { responsive: tab.responsive }),
				...(tab.activeLinkOptions && { activeLinkOptions: tab.activeLinkOptions }),
				disabled: !!tab.disabled,
				active: !!tab.active
			};

			// Check if the tabset is a router tabset
			if (!this.isRouterTabset) {
				// Check if the route configuration has a component or loadChildren property
				if (tab.template) {
					// Set the template property to the config object
					route.template = tab.template;
				} else if (tab.component) {
					// Set the component property to the config object
					route.component = tab.component;
				}
			}

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
				tap(() => this.reload$.next(true)),
				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Loads a template into a specified container.
	 *
	 * This method clears any existing content in the provided container
	 * and then creates an embedded view for the given template, inserting
	 * it into the container.
	 *
	 * @param template The template to be loaded into the container.
	 * @param container The container where the template will be inserted.
	 */
	loadTemplateForTab(template: TemplateRef<any>, container: ViewContainerRef): void {
		// Clear any existing content in the container
		container.clear();

		// Create an embedded view for the provided template and insert it into the container
		container.createEmbeddedView(template);
	}

	/**
	 * Create and insert a dynamic component into the specified ViewContainerRef.
	 *
	 * This method clears any existing content in the provided container,
	 * then creates a new instance of the specified component and inserts it
	 * into the container.
	 *
	 * @param component The component to be created dynamically.
	 * @param container The ViewContainerRef where the component should be inserted.
	 */
	loadComponentForTab(component: Type<any>, container: ViewContainerRef): void {
		// Ensure the container is available and clear any existing content
		container.clear();

		// Create and insert the component into the view container
		container.createComponent(component);
	}

	ngOnDestroy(): void {}
}
