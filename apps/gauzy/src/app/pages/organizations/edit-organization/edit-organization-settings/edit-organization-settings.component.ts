import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import { Country, Organization } from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { OrganizationEditStore } from 'apps/gauzy/src/app/@core/services/organization-edit-store.service';
import { Subject } from 'rxjs';
import { first, takeUntil } from 'rxjs/operators';
import { CountryService } from '../../../../@core/services/country.service';
import { OrganizationsService } from '../../../../@core/services/organizations.service';

export enum ListsInputType {
	DEPARTMENTS = 'DEPARTMENTS',
	POSITIONS = 'POSITIONS',
	VENDORS = 'VENDORS'
}

@Component({
	selector: 'ngx-edit-organization-settings',
	templateUrl: './edit-organization-settings.component.html',
	styleUrls: [
		'./edit-organization-settings.component.scss',
		'../../../employees/edit-employee/edit-employee-profile/edit-employee-profile.component.scss'
	],
	providers: [CountryService]
})
export class EditOrganizationSettingsComponent implements OnInit {
	organization: Organization;

	departments: string[] = [];
	positions: string[] = [];
	vendors: string[] = [];
	employeesCount: number;
	countries: Country[] = [];

	private _ngOnDestroy$ = new Subject();
	routeParams: Params;
	tabs: any[];

	constructor(
		private route: ActivatedRoute,
		private organizationService: OrganizationsService,
		private countryService: CountryService,
		private toastrService: NbToastrService,
		private translateService: TranslateService,
		private organizationEditStore: OrganizationEditStore
	) {}

	ngOnInit() {
		this.route.params
			.pipe(takeUntil(this._ngOnDestroy$))
			.subscribe((params) => {
				this.routeParams = params;
				this._loadOrganization(params.id);
			});

		this.loadTabs();
		this._applyTranslationOnTabs();
	}

	getRoute(tabName: string) {
		return `/pages/organizations/edit/${this.routeParams.id}/settings/${tabName}`;
	}

	loadTabs() {
		this.tabs = [
			{
				title: this.getTranslation('ORGANIZATIONS_PAGE.MAIN'),
				icon: 'person-outline',
				responsive: true,
				route: this.getRoute('main')
			},
			{
				title: this.getTranslation('ORGANIZATIONS_PAGE.LOCATION'),
				icon: 'pin-outline',
				responsive: true,
				route: this.getRoute('location')
			},
			{
				title: this.getTranslation('ORGANIZATIONS_PAGE.DEPARTMENTS'),
				icon: 'briefcase-outline',
				responsive: true,
				route: this.getRoute('departments')
			},
			{
				title: this.getTranslation('ORGANIZATIONS_PAGE.CLIENTS'),
				icon: 'briefcase-outline',
				responsive: true,
				route: this.getRoute('clients')
			},
			{
				title: this.getTranslation('ORGANIZATIONS_PAGE.POSITIONS'),
				icon: 'award-outline',
				responsive: true,
				route: this.getRoute('positions')
			},
			{
				title: this.getTranslation('ORGANIZATIONS_PAGE.VENDORS'),
				icon: 'car-outline',
				responsive: true,
				route: this.getRoute('vendors')
			},
			{
				title: this.getTranslation('ORGANIZATIONS_PAGE.PROJECTS'),
				icon: 'book-outline',
				responsive: true,
				route: this.getRoute('projects')
			},
			{
				title: this.getTranslation('ORGANIZATIONS_PAGE.EDIT.TEAMS'),
				icon: 'people-outline',
				responsive: true,
				route: this.getRoute('teams')
			},
			{
				title: this.getTranslation('ORGANIZATIONS_PAGE.SETTINGS'),
				icon: 'settings-outline',
				responsive: true,
				route: this.getRoute('settings')
			}
		];
	}

	goBack() {
		const currentURL = window.location.href;
		window.location.href = currentURL.substring(
			0,
			currentURL.indexOf('/settings')
		);
	}

	private async _loadOrganization(id: string) {
		try {
			this.organization = await this.organizationService
				.getById(id)
				.pipe(first())
				.toPromise();

			this.organizationEditStore.selectedOrganization = this.organization;
		} catch (error) {
			this.toastrService.danger(
				error.error.message || error.message,
				'Error'
			);
		}
	}

	getTranslation(prefix: string) {
		let result = '';
		this.translateService.get(prefix).subscribe((res) => {
			result = res;
		});
		return result;
	}

	private _applyTranslationOnTabs() {
		this.translateService.onLangChange
			.pipe(takeUntil(this._ngOnDestroy$))
			.subscribe(() => {
				this.loadTabs();
			});
	}
}
