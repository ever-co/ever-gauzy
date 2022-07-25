import {
	AfterViewInit,
	Component,
	Inject,
	PLATFORM_ID,
	ViewChild,
	OnInit
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { tap } from 'rxjs/operators';
import { NbLayoutComponent, NbThemeService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/common-angular';
import { WindowModeBlockScrollService } from '../../services';
import { Store, UsersService } from '../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-public-layout',
	styleUrls: ['./public.layout.scss'],
	templateUrl: './public.layout.html'
})
export class PublicLayoutComponent implements OnInit, AfterViewInit {
	constructor(
		@Inject(PLATFORM_ID) private platformId,
		private readonly windowModeBlockScrollService: WindowModeBlockScrollService,
		private readonly store: Store,
		private readonly usersService: UsersService,
		private readonly themeService: NbThemeService
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
