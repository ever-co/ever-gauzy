import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Country, Organization } from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { OrganizationsService } from '../../../../../@core/services/organizations.service';
import { OrganizationEditStore } from '../../../../../@core/services/organization-edit-store.service';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { CountryService } from '../../../../../@core/services/country.service';
import { TranslationBaseComponent } from '../../../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';

@Component({
	selector: 'ga-edit-org-location',
	templateUrl: './edit-organization-location.component.html',
	styleUrls: ['./edit-organization-location.component.scss']
})
export class EditOrganizationLocationComponent extends TranslationBaseComponent
	implements OnInit {
	private _ngDestroy$ = new Subject<void>();

	selectedOrganization: Organization;
	countries: Country[];
	form: FormGroup;

	constructor(
		private fb: FormBuilder,
		private organizationService: OrganizationsService,
		private toastrService: NbToastrService,
		private organizationEditStore: OrganizationEditStore,
		private countryService: CountryService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.organizationEditStore.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((organization) => {
				this.selectedOrganization = organization;
				if (this.selectedOrganization) {
					this._initializeForm(this.selectedOrganization);
				}
			});
		this._loadOrganizationData();
	}

	async updateOrganizationSettings() {
		const contact = {
			country: this.form.value.country,
			city: this.form.value.city,
			address: this.form.value.address,
			address2: this.form.value.address2,
			postcode: this.form.value.postcode
		};
		const contactData = {
			...this.form.value,
			contact
		};
		this.organizationService.update(
			this.selectedOrganization.id,
			contactData
		);
		this.toastrService.primary(
			this.selectedOrganization.name + ' organization location updated.',
			'Success'
		);
		this._loadOrganizationData();
		this.goBack();
	}

	goBack() {
		const currentURL = window.location.href;
		window.location.href = currentURL.substring(
			0,
			currentURL.indexOf('/settings')
		);
	}

	private async _initializeForm(organization: Organization) {
		//Load countries before initializing the form
		await this.loadCountries();

		//Initialize form
		this.form = this.fb.group({
			country: [organization.contact ? organization.contact.country : ''],
			city: [organization.contact ? organization.contact.city : ''],
			postcode: [
				organization.contact ? organization.contact.postcode : ''
			],
			address: [organization.contact ? organization.contact.address : ''],
			address2: [
				organization.contact ? organization.contact.address2 : ''
			]
		});
	}

	private async _loadOrganizationData() {
		const id = this.selectedOrganization.id;
		const { items } = await this.organizationService.getAll(['contact'], {
			id
		});

		this.selectedOrganization = items[0];
		this.organizationEditStore.selectedOrganization = this.selectedOrganization;
	}

	private async loadCountries() {
		const { items } = await this.countryService.getAll();
		this.countries = items;
	}
}
