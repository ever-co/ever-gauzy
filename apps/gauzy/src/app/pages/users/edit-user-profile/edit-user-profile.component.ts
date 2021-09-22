import { Location } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { ActivatedRoute, Params } from '@angular/router';
import { IUser, ITag } from '@gauzy/contracts';
import { filter, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslationBaseComponent } from '../../../@shared/language-base';
import { UsersOrganizationsService } from '../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-edit-user-profile',
	templateUrl: './edit-user-profile.component.html',
	styleUrls: [
		'../../../@shared/user/edit-profile-form/edit-profile-form.component.scss'
	]
})
export class EditUserProfileComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {

	form: FormGroup;
	params: Params;
	user: IUser;

	tabs: any[];
	tags: ITag[];

	constructor(
		private readonly route: ActivatedRoute,
		private readonly location: Location,
		public readonly translateService: TranslateService,
		private readonly usersOrganizationsService: UsersOrganizationsService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.route.params
			.pipe(
				filter((params) => !!params),
				tap((params) => this.params = params),
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
				title: this.getTranslation(
					'USERS_PAGE.EDIT_USER.USER_ORGANIZATIONS'
				),
				icon: 'book-open-outline',
				responsive: true,
				route: this.getRoute('organizations')
			}
		];
	}

	private async getUserProfile() {
		const { id } = this.params;
		const { items } = await this.usersOrganizationsService.getAll(
			['user', 'user.role', 'user.tags'],
			{ id }
		);
		this.user = items[0].user;
	}

	ngOnDestroy() {}

	private _applyTranslationOnTabs() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this.loadTabs()),
				untilDestroyed(this)
			)
			.subscribe();
	}
}
