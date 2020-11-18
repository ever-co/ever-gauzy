import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ICountry, IOrganization } from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { OrganizationsService } from '../../../../../@core/services/organizations.service';
import { OrganizationEditStore } from '../../../../../@core/services/organization-edit-store.service';
import { filter } from 'rxjs/operators';
import { CountryService } from '../../../../../@core/services/country.service';
import { TranslationBaseComponent } from '../../../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '../../../../../@core/services/store.service';
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-edit-org-location',
	templateUrl: './edit-organization-location.component.html',
	styleUrls: ['./edit-organization-location.component.scss']
})
export class EditOrganizationLocationComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	selectedOrganization: IOrganization;
	countries: ICountry[];
	form: FormGroup;

	constructor(
		private router: Router,
		private fb: FormBuilder,
		private organizationService: OrganizationsService,
		private toastrService: NbToastrService,
		private organizationEditStore: OrganizationEditStore,
		private store: Store,
		private countryService: CountryService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe((organization) => {
				this._loadOrganizationData(organization);
			});

		//Load countries before initializing the form
		this.loadCountries();
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
		this.goBack();
	}

	goBack() {
		this.router.navigate([
			`/pages/organizations/edit/${this.selectedOrganization.id}`
		]);
	}

	//Initialize form
	private async _initializeForm(organization: IOrganization) {
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

	private async _loadOrganizationData(organization) {
		if (!organization) {
			return;
		}
		const id = organization.id;
		const { tenantId } = this.store.user;
		const { items } = await this.organizationService.getAll(
			['contact', 'tags'],
			{
				id,
				tenantId
			}
		);
		this.selectedOrganization = items[0];
		this._initializeForm(this.selectedOrganization);
		this.organizationEditStore.selectedOrganization = this.selectedOrganization;
	}

	private async loadCountries() {
		const { items } = await this.countryService.getAll();
		this.countries = items;
	}

	ngOnDestroy(): void {}
}
