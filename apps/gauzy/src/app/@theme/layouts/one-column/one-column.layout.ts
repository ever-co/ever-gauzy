import { AfterViewInit, Component, Inject, PLATFORM_ID, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable } from 'rxjs';
import { NbLayoutComponent, NbSidebarService } from '@nebular/theme';
import { UntilDestroy } from '@ngneat/until-destroy';
import { IUser } from '@gauzy/contracts';
import { NavigationBuilderService, Store } from '../../../@core/services';
import { LayoutService } from '../../../@core/services/layout.service';
import { WindowModeBlockScrollService } from '../../services/window-mode-block-scroll.service';
import { DEFAULT_SIDEBARS } from '../../components/theme-sidebar/default-sidebars';
import { ThemeLanguageSelectorService } from '../../components/theme-sidebar/theme-settings/components/theme-language-selector.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-one-column-layout',
	styleUrls: ['./one-column.layout.scss'],
	templateUrl: './one-column.layout.html'
})
export class OneColumnLayoutComponent implements OnInit, AfterViewInit, OnDestroy {
	@ViewChild(NbLayoutComponent) layout: NbLayoutComponent;

	private _user$: Observable<IUser>;
	loading: boolean;
	userMenu = [
		{ title: 'Profile', link: '/pages/auth/profile' },
		{ title: 'Log out', link: '/auth/logout' }
	];

	isOpen = false;
	isExpanded = true;
	isCollapse = true;
	trigger = true;

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
		this._user$ = new Observable();
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

	onCollapse(event: boolean) {
		this.isCollapse = event;
		if (!this.isCollapse && !this.isExpanded) this.toggle();
	}

	onStateChange(event) {
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
