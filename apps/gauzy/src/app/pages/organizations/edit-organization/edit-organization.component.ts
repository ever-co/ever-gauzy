import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Organization, PermissionsEnum } from '@gauzy/models';
import { Subject } from 'rxjs';
import { first, takeUntil } from 'rxjs/operators';
import { EmployeesService } from '../../../@core/services';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { Store } from '../../../@core/services/store.service';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';

@Component({
	templateUrl: './edit-organization.component.html',
	styleUrls: [
		'./edit-organization.component.scss',
		'../../dashboard/dashboard.component.scss'
	]
})
export class EditOrganizationComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	selectedOrg: Organization;
	selectedOrgFromHeader: Organization;
	employeesCount: number;
	hasEditPermission = false;
	private _ngDestroy$ = new Subject<void>();

	constructor(
		private route: ActivatedRoute,
		private router: Router,
		private organizationsService: OrganizationsService,
		private employeesService: EmployeesService,
		private store: Store,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	async ngOnInit() {
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
				const id = params.id;

				this.selectedOrg = await this.organizationsService
					.getById(id)
					.pipe(first())
					.toPromise();

				this.selectedOrgFromHeader = this.selectedOrg;
				this.loadEmployeesCount();
				this.store.selectedEmployee = null;

				this.store.selectedOrganization$
					.pipe(takeUntil(this._ngDestroy$))
					.subscribe((org) => {
						this.selectedOrgFromHeader = org;
						if (org && org.id) {
							this.router.navigate([
								'/pages/organizations/edit/' + org.id
							]);
						}
					});
			});
	}

	editOrg() {
		this.router.navigate([
			'/pages/organizations/edit/' + this.selectedOrg.id + '/settings'
		]);
	}

	editPublicPage() {
		this.router.navigate([
			'/share/organization/' + this.selectedOrg.profile_link
		]);
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}

	private async loadEmployeesCount() {
		const { total } = await this.employeesService
			.getAll([], { organization: { id: this.selectedOrg.id } })
			.pipe(first())
			.toPromise();

		this.employeesCount = total;
	}
}
