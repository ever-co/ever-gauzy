import { AfterViewInit, Component, Inject, PLATFORM_ID, ViewChild, OnInit } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { tap } from 'rxjs/operators';
import { NbLayoutComponent, NbThemeService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store, distinctUntilChange } from '@gauzy/ui-core/common';
import { UsersService } from '@gauzy/ui-core/core';
import { WindowModeBlockScrollService } from '@gauzy/ui-core/theme';

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
		this.loadCurrentUserAndPermissions();
		this.themeService
			.getJsTheme()
			.pipe(
				distinctUntilChange(),
				tap((theme) =>
					this.themeService.changeTheme(
						(this.store.currentTheme ? this.store.currentTheme : theme.name) as string
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

	/**
	 * Loads the current user's data and updates the store with user details and permissions.
	 */
	private async loadCurrentUserAndPermissions() {
		const id = this.store.userId;

		// Return early if the user ID is not set
		if (!id) {
			console.warn('No user ID found in the store.');
			return;
		}

		try {
			// Fetch user details, including role permissions and tenant information
			this.user = await this.usersService.getMe(['role', 'role.rolePermissions', 'tenant'], true);

			// Update the store with user details and role permissions
			this.store.userRolePermissions = this.user.role.rolePermissions;
			this.store.user = this.user;
		} catch (error) {
			console.error('Error loading current user data:', error);
			// Handle the error as appropriate (e.g., user feedback, retry logic, etc.)
		}
	}
}
