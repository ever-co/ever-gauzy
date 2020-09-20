import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IOrganization, PermissionsEnum } from '@gauzy/models';
import { Subject } from 'rxjs';
import { first, takeUntil, switchMap, tap } from 'rxjs/operators';
import { EmployeesService } from '../../../@core/services';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { Store } from '../../../@core/services/store.service';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { OrganizationEditStore } from '../../../@core/services/organization-edit-store.service';
import { untilDestroyed } from 'ngx-take-until-destroy';

@Component({
	templateUrl: './edit-organization.component.html',
	styleUrls: [
		'./edit-organization.component.scss',
		'../../dashboard/dashboard.component.scss'
	]
})
export class EditOrganizationComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	selectedOrg: IOrganization;
	selectedOrgFromHeader: IOrganization;
	employeesCount: number;
	private _ngDestroy$ = new Subject<void>();

	constructor(
		private route: ActivatedRoute,
		private organizationsService: OrganizationsService,
		private employeesService: EmployeesService,
		private store: Store,
		readonly translateService: TranslateService,
		private organizationEditStore: OrganizationEditStore
	) {
		super(translateService);
	}

	async ngOnInit() {
		this.route.params
			.pipe(
				switchMap((params) =>
					this.organizationsService.getById(params.id, null, ['tags'])
				),
				tap((selectedOrg) => {
					this.selectedOrg = selectedOrg;
					this.store.selectedOrganization = this.selectedOrg;
					this.selectedOrgFromHeader = this.selectedOrg;
					this.loadEmployeesCount();
					this.store.selectedEmployee = null;
				}),
				switchMap(() => this.store.selectedOrganization$),
				tap((selectedOrg) => {
					this.selectedOrgFromHeader = selectedOrg;
					this.selectedOrg = selectedOrg;
					this.organizationEditStore.selectedOrganization = selectedOrg;
				}),
				takeUntil(this._ngDestroy$)
			)
			.subscribe();

		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((organization) => {
				if (organization) {
					this.selectedOrg = organization;
					this.loadEmployeesCount();
				}
			});
	}

	canEditPublicPage() {
		return this.store.hasPermission(PermissionsEnum.PUBLIC_PAGE_EDIT);
	}

	//Open the public page in a new tab
	editPublicPage() {
		window.open(
			'/share/organization/' + this.selectedOrg.profile_link,
			'_blank'
		);
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}

	private async loadEmployeesCount() {
		const { total } = await this.employeesService
			.getAll([], {
				organization: {
					id: this.selectedOrg.id,
					tenantId: this.selectedOrg.tenantId
				}
			})
			.pipe(first())
			.toPromise();

		this.employeesCount = total;
	}
}
