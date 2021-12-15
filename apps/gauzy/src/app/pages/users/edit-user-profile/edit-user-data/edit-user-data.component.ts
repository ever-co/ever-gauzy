import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { IUser, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { filter, tap } from 'rxjs/operators';
import { Store, UserIdService, UsersService } from '../../../../@core/services';
import { TranslationBaseComponent } from '../../../../@shared/language-base';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-edit-user-data',
	templateUrl: './edit-user-data.component.html'
})
export class EditUserDataComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {

	params: Params;
	user: IUser;

	constructor(
		private readonly route: ActivatedRoute,
		public readonly translateService: TranslateService,
		private readonly router: Router,
		private readonly userIdService: UserIdService,
		private readonly usersService: UsersService,
		private readonly store: Store
	) {
		super(translateService);
	}

	ngOnInit() {
		this.route.params
			.pipe(
				filter((params) => !!params),
				tap((params) => this.params = params),
				tap((params) => this.userIdService.userId = params.id),
				tap(() => this.getUserProfile()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	goBack() {
		this.router.navigate(['/pages/users']);
	}

	private async getUserProfile() {

		const { id } = this.params;
		const user = await this.usersService.getUserById(id, ['role', 'tags']);

		if (user.role.name === RolesEnum.SUPER_ADMIN) {
			/**
			 * Redirect If Edit Super Admin Without Permission
			 */
			if (!this.store.hasPermission(PermissionsEnum.SUPER_ADMIN_EDIT)) {
				this.router.navigate(['/pages/users']);
				return;
			}
		}
		this.user = user;
	}

	ngOnDestroy() { }
}
