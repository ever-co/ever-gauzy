import {
	AfterViewInit,
	Component,
	Inject,
	PLATFORM_ID,
	ViewChild,
	OnInit
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NbLayoutComponent } from '@nebular/theme';
import { filter, tap } from 'rxjs/operators';
import { IUser } from '@gauzy/contracts';
import { WindowModeBlockScrollService } from '../../services/window-mode-block-scroll.service';
import { NavigationBuilderService, Store } from '../../../@core/services';
import { DEFAULT_SIDEBARS } from '../../components/theme-sidebar/default-sidebars';

@Component({
	selector: 'ngx-one-column-layout',
	styleUrls: ['./one-column.layout.scss'],
	templateUrl: './one-column.layout.html'
})
export class OneColumnLayoutComponent implements OnInit, AfterViewInit {
	@ViewChild(NbLayoutComponent) layout: NbLayoutComponent;

	user: IUser;
	loading: boolean;
	userMenu = [
		{ title: 'Profile', link: '/pages/auth/profile' },
		{ title: 'Log out', link: '/auth/logout' }
	];

	constructor(
		@Inject(PLATFORM_ID) private platformId,
		private readonly windowModeBlockScrollService: WindowModeBlockScrollService,
		private readonly store: Store,
		public readonly navigationBuilderService: NavigationBuilderService
	) {
		Object.entries(DEFAULT_SIDEBARS).forEach(([id, config]) => {
			navigationBuilderService.registerSidebar(id, config);
			navigationBuilderService.addSidebarActionItem(config.actionItem);
		});
		navigationBuilderService.getSidebarWidgets();
	}

	ngOnInit() {
		this.loading = true;
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
