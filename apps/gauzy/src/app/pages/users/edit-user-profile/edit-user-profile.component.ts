import { Location } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { UntypedFormGroup } from '@angular/forms';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { IUser, ITag, RolesEnum } from '@gauzy/contracts';
import { firstValueFrom } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/i18n';
import { UsersService } from '@gauzy/ui-sdk/core';
import { AuthService } from '@gauzy/ui-sdk/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-edit-user-profile',
	templateUrl: './edit-user-profile.component.html',
	styleUrls: ['./edit-user-profile.component.scss']
})
export class EditUserProfileComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	form: UntypedFormGroup;
	params: Params;
	user: IUser;

	tabs: any[];
	tags: ITag[];

	constructor(
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly location: Location,
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
				tap(() => this.loadTabs()),
				tap(() => this.getUserProfile()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this._applyTranslationOnTabs();
	}

	goBack() {
		this.location.back();
	}

	getRoute(tab: string): string {
		return `/pages/users/edit/${this.params.id}/${tab}`;
	}

	loadTabs() {
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
		const { id } = this.params;
		const user = await this.usersService.getUserById(id, ['role', 'tags']);

		if (user.role.name === RolesEnum.SUPER_ADMIN) {
			/**
			 * Redirect If Edit Super Admin Without Permission
			 */
			const hasSuperAdminRole = await firstValueFrom(this.authService.hasRole([RolesEnum.SUPER_ADMIN]));
			if (!hasSuperAdminRole) {
				this.router.navigate(['/pages/users']);
				return;
			}
		}
		this.user = user;
	}

	private _applyTranslationOnTabs() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this.loadTabs()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy() {}
}
