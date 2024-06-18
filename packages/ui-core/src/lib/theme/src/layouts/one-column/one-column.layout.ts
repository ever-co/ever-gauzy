import { AfterViewInit, Component, Inject, PLATFORM_ID, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable } from 'rxjs';
import { NbLayoutComponent, NbSidebarService } from '@nebular/theme';
import { UntilDestroy } from '@ngneat/until-destroy';
import { IUser } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/common';
import { LayoutService, NavigationBuilderService } from '@gauzy/ui-core/core';
import { WindowModeBlockScrollService } from '../../services';
import { DEFAULT_SIDEBARS } from '../../components/theme-sidebar/default-sidebars';
import { ThemeLanguageSelectorService } from '../../components/theme-sidebar/theme-settings/components/theme-language-selector/theme-language-selector.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-one-column-layout',
	styleUrls: ['./one-column.layout.scss'],
	templateUrl: './one-column.layout.html'
})
export class OneColumnLayoutComponent implements OnInit, AfterViewInit, OnDestroy {
	userMenu = [
		{ title: 'Profile', link: '/pages/auth/profile' },
		{ title: 'Log out', link: '/auth/logout' }
	];
	loading: boolean;
	isOpen: boolean = false;
	isExpanded: boolean = true;
	isCollapse: boolean = true;
	trigger: boolean = true;

	private _user$: Observable<IUser> = new Observable();

	@ViewChild(NbLayoutComponent) layout: NbLayoutComponent;

	constructor(
		@Inject(PLATFORM_ID) private platformId,
		private readonly windowModeBlockScrollService: WindowModeBlockScrollService,
		private readonly store: Store,
		public readonly navigationBuilderService: NavigationBuilderService,
		private readonly sidebarService: NbSidebarService,
		private readonly layoutService: LayoutService,
		private readonly languageSelectorService: ThemeLanguageSelectorService
	) {
		Object.entries(DEFAULT_SIDEBARS).forEach(([id, config]) => {
			navigationBuilderService.registerSidebar(id, config);
			navigationBuilderService.addSidebarActionItem(config.actionItem);
		});
		navigationBuilderService.getSidebarWidgets();
	}

	ngOnInit() {
		this.loading = true;
		this.user$ = this.store.user$;
		this.loading = false;
		this.languageSelectorService.initialize();
	}

	ngAfterViewInit() {
		if (isPlatformBrowser(this.platformId)) {
			this.windowModeBlockScrollService.register(this.layout);
		}
	}

	/**
	 * Toggles the expansion state of the component and updates the sidebar accordingly.
	 * If the component is expanded, it expands the 'menu-sidebar'.
	 * If the component is collapsed, it triggers a sidebar toggle and changes the layout size.
	 */
	toggle() {
		this.isExpanded = !this.isExpanded;
		if (this.isExpanded) {
			this.sidebarService.expand('menu-sidebar');
		} else {
			this.trigger = true;
			this.sidebarService.toggle(true, 'menu-sidebar');
			this.layoutService.changeLayoutSize();
		}
	}

	/**
	 * Updates the state of the component based on the given event.
	 *
	 * @param {boolean} event - The event that triggered the collapse.
	 */
	onCollapse(event: boolean) {
		this.isCollapse = event;
		if (!this.isCollapse && !this.isExpanded) this.toggle();
	}

	/**
	 * Updates the state of the component based on the given event.
	 *
	 * @param {string} event - The event that triggered the state change.
	 *
	 */
	onStateChange(event: string): void {
		this.isExpanded = event === 'expanded' ? true : false;
		this.trigger = event === 'compacted' ? true : this.isCollapse;
	}

	ngOnDestroy() {
		this.navigationBuilderService.clearSidebars();
		this.navigationBuilderService.clearActionBars();
	}

	public get user$(): Observable<IUser> {
		return this._user$;
	}

	public set user$(value: Observable<IUser>) {
		this._user$ = value;
	}
}
