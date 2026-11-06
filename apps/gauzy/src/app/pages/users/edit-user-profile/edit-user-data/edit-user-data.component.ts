import { Component, OnDestroy, OnInit, ChangeDetectionStrategy, Optional } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { IUser, RolesEnum } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { AuthService, UserIdService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { UsersService } from '@gauzy/ui-core/core';
import { EditUserProfileComponent } from '../edit-user-profile.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-edit-user-data',
	templateUrl: './edit-user-data.component.html',
	styleUrls: ['./edit-user-data.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class EditUserDataComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	params: Params;
	user: IUser;
	/** The user could not be loaded: the tab offers to try again or go back, instead of a spinner that never ends. */
	failed = false;
	/** Numbers each load: only the latest one, for the page's current user, is applied. */
	private _loadSeq = 0;

	constructor(
		private readonly route: ActivatedRoute,
		public readonly translateService: TranslateService,
		private readonly router: Router,
		private readonly userIdService: UserIdService,
		private readonly usersService: UsersService,
		private readonly authService: AuthService,
		/** The page around the tab, whose header loads the user on its own. */
		@Optional() private readonly profilePage?: EditUserProfileComponent
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

	/** Loads the user again after a failed load, and the page header with it when its own load failed too. */
	retry() {
		this.getUserProfile();
		this.profilePage?.retryIfFailed();
	}

	private async getUserProfile() {
		const seq = ++this._loadSeq;
		const { id } = this.params;
		const isCurrent = () => seq === this._loadSeq && id === this.params?.id;
		this.user = null;
		this.failed = false;
		try {
			const user = await this.usersService.getUserById(id, ['role', 'tags']);

			if (user?.role?.name === RolesEnum.SUPER_ADMIN) {
				/**
				 * Redirect If Edit Super Admin Without Permission
				 */
				const hasSuperAdminRole = await firstValueFrom(this.authService.hasRole([RolesEnum.SUPER_ADMIN]));
				if (!hasSuperAdminRole) {
					if (isCurrent()) {
						this.router.navigate(['/pages/users']);
					}
					return;
				}
			}
			if (isCurrent()) {
				this.user = user;
			}
		} catch (error) {
			if (isCurrent()) {
				console.error('Error while loading the user', error);
				this.failed = true;
			}
		}
	}

	ngOnDestroy() {}
}
