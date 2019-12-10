import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Country, Organization } from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { EmployeesService } from '../../../../../@core/services';
import { OrganizationsService } from '../../../../../@core/services/organizations.service';

@Component({
	selector: 'ga-edit-org-location',
	templateUrl: './edit-organization-location.component.html',
	styleUrls: ['./edit-organization-location.component.scss']
})
export class EditOrganizationLocationComponent implements OnInit {
	@Input()
	organization: Organization;

	@Input()
	countries: Country[];

	form: FormGroup;

	constructor(
		private fb: FormBuilder,
		private organizationService: OrganizationsService,
		private toastrService: NbToastrService
	) {}

	ngOnInit(): void {
		this._initializedForm();
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

	private _initializedForm() {
		this.form = this.fb.group({
			country: [this.organization.country],
			city: [this.organization.city],
			postcode: [this.organization.postcode],
			address: [this.organization.address],
			address2: [this.organization.address2]
		});
	}
}
