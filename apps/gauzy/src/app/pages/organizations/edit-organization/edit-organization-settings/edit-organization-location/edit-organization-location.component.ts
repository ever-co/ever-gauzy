import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Country, Organization } from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { OrganizationsService } from '../../../../../@core/services/organizations.service';
import { OrganizationEditStore } from 'apps/gauzy/src/app/@core/services/organization-edit-store.service';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { CountryService } from 'apps/gauzy/src/app/@core/services/country.service';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';

@Component({
	selector: 'ga-edit-org-location',
	templateUrl: './edit-organization-location.component.html',
	styleUrls: ['./edit-organization-location.component.scss']
})
export class EditOrganizationLocationComponent extends TranslationBaseComponent
	implements OnInit {
	private _ngDestroy$ = new Subject<void>();

	organization: Organization;
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
				this.organization = organization;
				if (this.organization) {
					this._initializeForm(this.organization);
				}
			});
	}

	async updateOrganizationSettings() {
		this.organizationService.update(
			this.organization.id,
			this.form.getRawValue()
		);
		this.toastrService.primary(
			this.organization.name + ' organization location updated.',
			'Success'
		);
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
			country: [organization.country],
			city: [organization.city],
			postcode: [organization.postcode],
			address: [organization.address],
			address2: [organization.address2]
		});
	}

	private async loadCountries() {
		const { items } = await this.countryService.getAll();
		this.countries = items;
	}
}
