import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { IUser } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { filter, tap } from 'rxjs/operators';
import { UserIdService, UsersOrganizationsService } from '../../../../@core/services';
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
		private readonly usersOrganizationsService: UsersOrganizationsService,
		public readonly translateService: TranslateService,
		private readonly router: Router,
		private readonly userIdService: UserIdService
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
		const { items } = await this.usersOrganizationsService.getAll(
			['user', 'user.role', 'user.tags'],
			{ id }
		);

		this.user = items[0].user;
	}

	ngOnDestroy() { }
}
