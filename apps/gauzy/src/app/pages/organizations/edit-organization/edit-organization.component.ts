import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IOrganization, PermissionsEnum } from '@gauzy/contracts';
import { filter, first } from 'rxjs/operators';
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
	params: any;

	constructor(
		private router: Router,
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
		this.route.params.pipe(untilDestroyed(this)).subscribe((params) => {
			if (params.id) {
				this.organizationsService
					.getById(params.id, null, ['tags'])
					.toPromise()
					.then((selectedOrg) => {
						this.setSelectedOrg(selectedOrg);
					});
			}
		});

		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe((organization) => {
				this.setSelectedOrg(organization);
			});
	}

	setSelectedOrg(selectedOrg) {
		this.store.selectedEmployee = null;
		this.selectedOrg = selectedOrg;
		this.store.selectedOrganization = this.selectedOrg;
		this.store.organizationId = this.selectedOrg.id;
		this.selectedOrgFromHeader = this.selectedOrg;
	}

	canEditPublicPage() {
		return this.store.hasPermission(PermissionsEnum.PUBLIC_PAGE_EDIT);
	}

	// Converts the route into a string that can be used
	// with the window.open() function
	editPublicPage() {
		const url = this.router.serializeUrl(
			this.router.createUrlTree([
				`/share/organization/${this.selectedOrg.profile_link}`
			])
		);
		window.open('#' + url, '_blank');
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
