import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, UrlSerializer } from '@angular/router';
import { Location } from '@angular/common';
import { IOrganization } from '@gauzy/contracts';
import { firstValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	EmployeesService,
	OrganizationsService,
	Store
} from '../../../@core/services';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';

@UntilDestroy({ checkProperties: true })
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
	params: any;

	constructor(
		private readonly router: Router,
		private readonly route: ActivatedRoute,
		private readonly organizationsService: OrganizationsService,
		private readonly employeesService: EmployeesService,
		private readonly store: Store,
		readonly translateService: TranslateService,
		private readonly _urlSerializer: UrlSerializer,
		private readonly _location: Location
	) {
		super(translateService);
	}

	async ngOnInit() {
		this.route.params.pipe(untilDestroyed(this)).subscribe((params) => {
			if (params.id) {
				firstValueFrom(
					this.organizationsService.getById(params.id, null, ['tags'])
				).then((organization) => {
					this.setSelectedOrg(organization);
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
		this.loadEmployeesCount();
	}

	setSelectedOrg(selectedOrg) {
		this.store.selectedEmployee = null;
		this.selectedOrg = selectedOrg;
		this.store.selectedOrganization = this.selectedOrg;
		this.store.organizationId = this.selectedOrg.id;
		this.selectedOrgFromHeader = this.selectedOrg;
	}

	/**
	 * Create URL tree for organization edit public page
	 *
	 * @returns
	 */
	editPublicPage() {
		if (!this.selectedOrg) {
			return;
		}

		// The call to Location.prepareExternalUrl is the key thing here.
		let tree = this.router.createUrlTree([`/share/organization/${this.selectedOrg.profile_link}`]);

    	// As far as I can tell you don't really need the UrlSerializer.
		const externalUrl = this._location.prepareExternalUrl(this._urlSerializer.serialize(tree));
		window.open(externalUrl, '_blank');
	}

	private async loadEmployeesCount() {
		const { tenantId } = this.store.user;
		const { total } = await firstValueFrom(
			this.employeesService.getAll([], {
				organizationId: this.selectedOrg.id,
				tenantId
			})
		);
		this.employeesCount = total;
	}

	ngOnDestroy() {}
}
