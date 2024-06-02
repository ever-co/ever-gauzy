import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { IUser, RolesEnum } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { AuthService, UserIdService } from '../../../../@core/services';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/shared';
import { UsersService } from '@gauzy/ui-sdk/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-edit-user-data',
	templateUrl: './edit-user-data.component.html',
	styleUrls: ['./edit-user-data.component.scss']
})
export class EditUserDataComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	params: Params;
	user: IUser;

	constructor(
		private readonly route: ActivatedRoute,
		public readonly translateService: TranslateService,
		private readonly router: Router,
		private readonly userIdService: UserIdService,
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
				tap((params) => (this.userIdService.userId = params.id)),
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
			const hasSuperAdminRole = await firstValueFrom(this.authService.hasRole([RolesEnum.SUPER_ADMIN]));
			if (!hasSuperAdminRole) {
				this.router.navigate(['/pages/users']);
				return;
			}
		}
		this.user = user;
	}

	ngOnDestroy() {}
}
