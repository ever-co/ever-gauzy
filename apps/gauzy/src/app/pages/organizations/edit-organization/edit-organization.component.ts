import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Data, Router, UrlSerializer } from '@angular/router';
import { Location } from '@angular/common';
import { IOrganization, PermissionsEnum } from '@gauzy/contracts';
import { debounceTime } from 'rxjs';
import { filter, map, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store, distinctUntilChange } from '@gauzy/ui-core/common';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './edit-organization.component.html',
	styleUrls: ['./edit-organization.component.scss', '../../dashboard/dashboard.component.scss']
})
export class EditOrganizationComponent extends TranslationBaseComponent implements AfterViewInit, OnInit, OnDestroy {
	public organization: IOrganization;

	constructor(
		private readonly router: Router,
		private readonly route: ActivatedRoute,
		private readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly _urlSerializer: UrlSerializer,
		private readonly _location: Location
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.route.data
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				filter((data: Data) => !!data && !!data.organization),
				map(({ organization }) => organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit(): void {
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				debounceTime(200),
				distinctUntilChange(),
				tap((organization: IOrganization) => {
					this.router.navigate([
						'/pages/organizations/edit',
						organization.id,
						this.route.firstChild.snapshot.routeConfig.path
					]);
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
		if (!this.organization || !this.store.hasPermission(PermissionsEnum.PUBLIC_PAGE_EDIT)) {
			return;
		}
		const { id, profile_link } = this.organization;

		// The call to Location.prepareExternalUrl is the key thing here.
		let tree = this.router.createUrlTree([`/share/organization/${profile_link}/${id}`]);

		// As far as I can tell you don't really need the UrlSerializer.
		const externalUrl = this._location.prepareExternalUrl(this._urlSerializer.serialize(tree));
		window.open(externalUrl, '_blank');
	}

	ngOnDestroy(): void { }
}
