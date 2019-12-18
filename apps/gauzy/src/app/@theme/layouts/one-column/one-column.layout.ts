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
import { UsersService } from '../../../@core/services/users.service';

import { WindowModeBlockScrollService } from '../../services/window-mode-block-scroll.service';
import { Store } from '../../../@core/services/store.service';

@Component({
	selector: 'ngx-one-column-layout',
	styleUrls: ['./one-column.layout.scss'],
	templateUrl: './one-column.layout.html'
})
export class OneColumnLayoutComponent implements OnInit, AfterViewInit {
	constructor(
		@Inject(PLATFORM_ID) private platformId,
		private windowModeBlockScrollService: WindowModeBlockScrollService,
		private usersService: UsersService,
		private store: Store,
		private directionService: NbLayoutDirectionService
	) {}
	@ViewChild(NbLayoutComponent, { static: false }) layout: NbLayoutComponent;

	user: any;

	userMenu = [
		{ title: 'Profile', link: '/pages/auth/profile' },
		{ title: 'Log out', link: '/auth/logout' }
	];

	layout_direction: NbLayoutDirection = this.directionService.getDirection();
	sidebar_class = 'menu-sidebar';

	ngOnInit() {
		this.loadUserData();

		if (this.layout_direction === NbLayoutDirection.RTL) {
			this.sidebar_class = 'menu-sidebar-rtl';
		}
	}

	ngAfterViewInit() {
		if (isPlatformBrowser(this.platformId)) {
			this.windowModeBlockScrollService.register(this.layout);
		}
	}

	private async loadUserData() {
		const id = this.store.userId;
		this.user = await this.usersService.getUserById(id);

		// We did not doing nothing with the result?
		// Also if user still did not have organization?
		// const { orgId } = await this.usersOrganizationsService.findOne({ userId: id }).pipe(first()).toPromise();

		// TODO: Fix me!
		// this.store.selectedOrganizationId = orgId;
	}
}
