import {
	AfterViewInit,
	Component,
	Inject,
	PLATFORM_ID,
	ViewChild,
	OnInit
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
	NbLayoutComponent,
	NbLayoutDirectionService,
	NbLayoutDirection
} from '@nebular/theme';
import { WindowModeBlockScrollService } from '../../services/window-mode-block-scroll.service';
import { Store } from '../../../@core/services/store.service';
import { IUser } from '@gauzy/contracts';
import { filter, tap } from 'rxjs/operators';
import { DEFAULT_SIDEBARS } from '../../default-sidebars';
import {
	ISidebarConfig,
	NavigationBuilderService
} from '../../../@core/services';

@Component({
	selector: 'ngx-one-column-layout',
	styleUrls: ['./one-column.layout.scss'],
	templateUrl: './one-column.layout.html'
})
export class OneColumnLayoutComponent implements OnInit, AfterViewInit {
	availableSidebarWidgets$: ISidebarConfig[] = [];

	constructor(
		@Inject(PLATFORM_ID) private platformId,
		private readonly windowModeBlockScrollService: WindowModeBlockScrollService,
		private readonly directionService: NbLayoutDirectionService,
		private readonly store: Store,
		public readonly navigationBuilderService: NavigationBuilderService
	) {
		Object.entries(DEFAULT_SIDEBARS).map(([id, config]) =>
			navigationBuilderService.registerSidebar(id, config)
		);
		this.availableSidebarWidgets$ = navigationBuilderService.getSidebarWidgets();
	}

	@ViewChild(NbLayoutComponent) layout: NbLayoutComponent;

	user: IUser;
	loading: boolean;
	userMenu = [
		{ title: 'Profile', link: '/pages/auth/profile' },
		{ title: 'Log out', link: '/auth/logout' }
	];
	layoutDirection: NbLayoutDirection = this.directionService.getDirection();
	sidebarClass = 'menu-sidebar';

	ngOnInit() {
		this.loading = true;
		if (this.layoutDirection === NbLayoutDirection.RTL) {
			this.sidebarClass = 'menu-sidebar-rtl';
		}
		this.store.user$
			.pipe(
				filter((user) => !!user),
				tap((user: IUser) => (this.user = user))
			)
			.subscribe();
		this.loading = false;
	}

	ngAfterViewInit() {
		if (isPlatformBrowser(this.platformId)) {
			this.windowModeBlockScrollService.register(this.layout);
		}
	}
}
