import {
	AfterViewInit,
	Component,
	Inject,
	PLATFORM_ID,
	ViewChild,
	OnInit
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NbLayoutComponent, NbThemeService } from '@nebular/theme';

import { WindowModeBlockScrollService } from '../../services/window-mode-block-scroll.service';
import { Store } from '../../../@core/services/store.service';
import { UsersService } from '../../../@core/services';
import { tap } from 'rxjs/operators';
import { distinctUntilChange } from 'packages/common-angular/dist';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
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
		private usersService: UsersService,
		private themeService: NbThemeService
	) {}
	@ViewChild(NbLayoutComponent) layout: NbLayoutComponent;

	user: any;

	ngOnInit() {
		this.loadUserData();
		this.themeService
			.getJsTheme()
			.pipe(
				distinctUntilChange(),
				tap((theme) =>
					this.themeService.changeTheme(
						(this.store.currentTheme
							? this.store.currentTheme
							: theme.name) as string
					)
				),
				untilDestroyed(this)
			)
			.subscribe();
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
