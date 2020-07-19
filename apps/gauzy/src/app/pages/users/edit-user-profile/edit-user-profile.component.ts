import { Location } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { ActivatedRoute, Params } from '@angular/router';
import { User, Tag } from '@gauzy/models';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { UsersOrganizationsService } from '../../../@core/services/users-organizations.service';

@Component({
	selector: 'ngx-edit-user-profile',
	templateUrl: './edit-user-profile.component.html',
	styleUrls: [
		'../../../@shared/user/edit-profile-form/edit-profile-form.component.scss'
	]
})
export class EditUserProfileComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	form: FormGroup;
	routeParams: Params;
	selectedUser: User;

	tabs: any[];
	tags: Tag[];

	constructor(
		private route: ActivatedRoute,
		private location: Location,
		readonly translateService: TranslateService,
		private usersOrganizationsService: UsersOrganizationsService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.route.params
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((params) => {
				this.routeParams = params;
				this._loadUserData();
			});

		this.loadTabs();
		this._applyTranslationOnTabs();
	}

	goBack() {
		this.location.back();
	}

	getRoute(tab: string): string {
		return `/pages/users/edit/${this.routeParams.id}/${tab}`;
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

	private async _loadUserData() {
		const { id } = this.routeParams;
		const { items } = await this.usersOrganizationsService.getAll(
			['user', 'user.role', 'user.tags'],
			{ id }
		);

		this.selectedUser = items[0].user;
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}

	private _applyTranslationOnTabs() {
		this.translateService.onLangChange
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.loadTabs();
			});
	}
}
