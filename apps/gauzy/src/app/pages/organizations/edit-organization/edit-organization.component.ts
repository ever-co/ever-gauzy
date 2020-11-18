import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IOrganization, PermissionsEnum } from '@gauzy/models';
import { filter, first, switchMap, tap } from 'rxjs/operators';
import { EmployeesService } from '../../../@core/services';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { Store } from '../../../@core/services/store.service';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { OrganizationEditStore } from '../../../@core/services/organization-edit-store.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './edit-organization.component.html',
	styleUrls: [
		'./edit-organization.component.scss',
		'../../dashboard/dashboard.component.scss'
	]
})
export class EditOrganizationComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	selectedOrg: IOrganization;
	selectedOrgFromHeader: IOrganization;
	employeesCount: number;

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
					this.store.selectedEmployee = null;
				}),
				switchMap(() => this.store.selectedOrganization$),
				tap((selectedOrg) => {
					this.selectedOrgFromHeader = selectedOrg;
					this.selectedOrg = selectedOrg;
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe((organization) => {
				if (organization) {
					this.selectedOrg = organization;
					this.organizationEditStore.selectedOrganization = this.selectedOrg;
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

	ngOnDestroy() {}

	private async loadEmployeesCount() {
		const { tenantId } = this.store.user;
		const { total } = await this.employeesService
			.getAll([], {
				organizationId: this.selectedOrg.id,
				tenantId
			})
			.pipe(first())
			.toPromise();
		this.employeesCount = total;
	}
}
