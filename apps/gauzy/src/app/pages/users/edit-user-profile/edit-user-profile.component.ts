import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { filter, firstValueFrom, tap } from 'rxjs';
import { NbRouteTab } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IUser, ITag, RolesEnum } from '@gauzy/contracts';
import { AuthService, UsersService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ngx-edit-user-profile',
    templateUrl: './edit-user-profile.component.html',
    styleUrls: ['./edit-user-profile.component.scss'],
    standalone: false
})
export class EditUserProfileComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	form: FormGroup;
	params: Params;
	user: IUser;
	tabs: NbRouteTab[];
	tags: ITag[];

	constructor(
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		public readonly translateService: TranslateService,
		private readonly usersService: UsersService,
		private readonly authService: AuthService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.route.params
			.pipe(
				filter((params) => !!params),
				tap((params) => (this.params = params)),
				tap(() => this.registerPageTabs()),
				tap(() => this.getUserProfile()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this._applyTranslationOnTabs();
	}

	/**
	 * Generates the route for a given tab based on the current user ID.
	 *
	 * @param tab - The tab name to append to the route.
	 * @returns The full route string.
	 */
	getRoute(tab: string = ''): string {
		if (!this.params?.id) {
			return `/pages/users`;
		}

		return `/pages/users/edit/${this.params?.id}/${tab}`;
	}

	/**
	 * Registers page tabs for the dashboard module.
	 * Ensures that tabs are registered only once.
	 *
	 * @returns {void}
	 */
	registerPageTabs(): void {
		this.tabs = [
			{
				title: this.getTranslation('USERS_PAGE.EDIT_USER.MAIN'),
				icon: 'person-outline',
				responsive: true,
				route: this.getRoute('')
			},
			{
				title: this.getTranslation('USERS_PAGE.EDIT_USER.USER_ORGANIZATIONS'),
				icon: 'book-open-outline',
				responsive: true,
				route: this.getRoute('organizations')
			}
		];
	}

	/**
	 * GET user profile
	 */
	private async getUserProfile() {
		if (!this.params.id) {
			this.router.navigate(['/pages/users']);
			return;
		}

		this.user = await this.usersService.getUserById(this.params.id, ['role', 'tags']);

		if (this.user?.role?.name === RolesEnum.SUPER_ADMIN) {
			/**
			 * Redirect If Edit Super Admin Without Permission
			 */
			const hasSuperAdminRole = await firstValueFrom(
				this.authService.hasRole([RolesEnum.SUPER_ADMIN])
			);

			if (!hasSuperAdminRole) {
				this.router.navigate(['/pages/users']);
				return;
			}
		}
	}

	/**
	 * Subscribes to language change events and applies translations to page tabs.
	 * Ensures the tabs are updated dynamically when the language changes.
	 * Uses `untilDestroyed` to clean up subscriptions when the component is destroyed.
	 */
	private _applyTranslationOnTabs(): void {
		this.translateService.onLangChange
			.pipe(
				// Re-register page tabs on language change
				tap(() => this.registerPageTabs()),

				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy() {}
}
