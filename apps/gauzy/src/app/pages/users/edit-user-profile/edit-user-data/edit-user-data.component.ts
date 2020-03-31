import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { User } from '@gauzy/models';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { UsersOrganizationsService } from '../../../../@core/services/users-organizations.service';
import { TranslationBaseComponent } from '../../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';

@Component({
	selector: 'ngx-edit-user-data',
	templateUrl: './edit-user-data.component.html'
})
export class EditUserDataComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	form: FormGroup;
	routeParams: Params;
	selectedUser: User;

	constructor(
		private route: ActivatedRoute,
		private usersOrganizationsService: UsersOrganizationsService,
		readonly translateService: TranslateService,
		private readonly router: Router
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
	}

	goBack() {
		this.router.navigate(['/pages/users']);
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
