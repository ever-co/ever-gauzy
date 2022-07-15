import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, UrlSerializer } from '@angular/router';
import { Location } from '@angular/common';
import { IOrganization } from '@gauzy/contracts';
import { firstValueFrom } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/common-angular';
import { EmployeesService, Store } from '../../../@core/services';
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

	employeesCount: number;
	organization: IOrganization;

	constructor(
		private readonly router: Router,
		private readonly route: ActivatedRoute,
		private readonly employeesService: EmployeesService,
		private readonly store: Store,
		readonly translateService: TranslateService,
		private readonly _urlSerializer: UrlSerializer,
		private readonly _location: Location
	) {
		super(translateService);
	}

	ngOnInit() {
		this.route.data
			.pipe(
				distinctUntilChange(),
				filter((data) => !!data && !!data.organization),
				tap(({ organization }) => this.organization = organization),
				tap(() => this.loadEmployeesCount()),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				distinctUntilChange(),
				tap(({ id }) => {
					this.router.navigate(['/pages/organizations/edit/', id]);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Create URL tree for organization edit public page
	 *
	 * @returns
	 */
	editPublicPage() {
		if (!this.organization) {
			return;
		}

		// The call to Location.prepareExternalUrl is the key thing here.
		let tree = this.router.createUrlTree([`/share/organization/${this.organization.profile_link}`]);

    	// As far as I can tell you don't really need the UrlSerializer.
		const externalUrl = this._location.prepareExternalUrl(this._urlSerializer.serialize(tree));
		window.open(externalUrl, '_blank');
	}

	private async loadEmployeesCount() {
		if (!this.organization) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const { total } = await firstValueFrom(
			this.employeesService.getAll([], {
				organizationId,
				tenantId
			})
		);
		this.employeesCount = total;
	}

	ngOnDestroy() {}
}
