import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Data, Router, UrlSerializer } from '@angular/router';
import { Location } from '@angular/common';
import { IOrganization, PermissionsEnum } from '@gauzy/contracts';
import { debounceTime } from 'rxjs';
import { filter, map, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { Store } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
    templateUrl: './edit-organization.component.html',
    styleUrls: ['./edit-organization.component.scss', '../../dashboard/dashboard.component.scss'],
    standalone: false
})
export class EditOrganizationComponent extends TranslationBaseComponent implements AfterViewInit, OnInit, OnDestroy {
	public organization: IOrganization;
	public logoFailed = false;

	get logoUrl(): string {
		return this.organization?.image?.fullUrl || this.organization?.imageUrl;
	}

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
				tap((organization: IOrganization) => this.setOrganization(organization)),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => this.setOrganization(organization)),
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
	 * Adopt an organization and give its logo a fresh chance at loading — otherwise
	 * one broken image would leave the placeholder in place for every organization
	 * selected afterwards.
	 *
	 * @param organization
	 */
	private setOrganization(organization: IOrganization): void {
		this.organization = organization;
		this.logoFailed = false;
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

	ngOnDestroy(): void {}
}
