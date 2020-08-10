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

import { WindowModeBlockScrollService } from '../../services/window-mode-block-scroll.service';
import { Store } from '../../../@core/services/store.service';
import { UsersService } from '../../../@core/services';

@Component({
	selector: 'ga-public-layout',
	styleUrls: ['./public.layout.scss'],
	templateUrl: './public.layout.html'
})
export class PublicLayoutComponent implements OnInit, AfterViewInit {
	constructor(
		@Inject(PLATFORM_ID) private platformId,
		private windowModeBlockScrollService: WindowModeBlockScrollService,
		private store: Store,
		private usersService: UsersService
	) {}
	@ViewChild(NbLayoutComponent) layout: NbLayoutComponent;

	user: any;

	ngOnInit() {
		this.loadUserData();
	}

	ngAfterViewInit() {
		if (isPlatformBrowser(this.platformId)) {
			this.windowModeBlockScrollService.register(this.layout);
		}
	}

	private async loadUserData() {
		const id = this.store.userId;
		if (!id) return;
		this.user = await this.usersService.getMe([
			'employee',
			'role',
			'role.rolePermissions',
			'tenant'
		]);

		this.store.userRolePermissions = this.user.role.rolePermissions;
		this.store.user = this.user;
	}
}
