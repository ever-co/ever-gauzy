import { Location } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { ActivatedRoute, Params } from '@angular/router';
import { User } from '@gauzy/models';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { UsersOrganizationsService } from '../../../@core/services/users-organizations.service';

@Component({
	selector: 'ngx-edit-user-profile',
	templateUrl: './edit-user-profile.component.html',
	styleUrls: [
		'../../../@shared/user/edit-profile-form/edit-profile-form.component.scss'
	]
})
export class EditUserProfileComponent implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	form: FormGroup;
	routeParams: Params;
	selectedUser: User;

	constructor(
		private route: ActivatedRoute,
		private location: Location,
		private usersOrganizationsService: UsersOrganizationsService
	) {}

	ngOnInit() {
		this.route.params
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((params) => {
				this.routeParams = params;
				this._loadUserData();
			});
	}

	goBack() {
		this.location.back();
	}

	private async _loadUserData() {
		const { id } = this.routeParams;
		const { items } = await this.usersOrganizationsService.getAll(
			['user', 'user.role'],
			{ id }
		);

		this.selectedUser = items[0].user;
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
