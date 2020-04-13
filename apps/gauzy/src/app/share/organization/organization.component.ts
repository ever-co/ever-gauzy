import { Component, OnInit, OnDestroy } from '@angular/core';
import { Store } from '../../@core/services/store.service';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { ActivatedRoute, Router } from '@angular/router';
import { OrganizationsService } from '../../@core/services/organizations.service';
import { EmployeesService } from '../../@core/services';
import { OrganizationRecurringExpenseService } from '../../@core/services/organization-recurring-expense.service';
import { TranslateService } from '@ngx-translate/core';
import { Organization, PermissionsEnum } from '@gauzy/models';
import { Subject } from 'rxjs';
import { first, takeUntil } from 'rxjs/operators';

@Component({
	selector: 'ngx-organization',
	templateUrl: './organization.component.html',
	styleUrls: ['./organization.component.scss']
})
export class OrganizationComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	organization: Organization;
	hasEditPermission = false;
	private _ngDestroy$ = new Subject<void>();

	loading = true;

	constructor(
		private route: ActivatedRoute,
		private router: Router,
		private organizationsService: OrganizationsService,
		private employeesService: EmployeesService,
		private organizationRecurringExpenseService: OrganizationRecurringExpenseService,
		private store: Store,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.store.userRolePermissions$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.hasEditPermission = this.store.hasPermission(
					PermissionsEnum.ALL_ORG_EDIT
				);
			});

		this.route.params
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (params) => {
				const profileLink = params.link;

				try {
					this.organization = await this.organizationsService
						.getByProfileLink(profileLink)
						.pipe(first())
						.toPromise();
				} catch (error) {
					await this.router.navigate(['/share/404']);
				}
			});
	}

	ngOnDestroy() {}
}
