import { Component, OnDestroy, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { IEmployee, IOrganization } from '@gauzy/contracts';
import { combineLatest } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { UrlPatternValidator } from '@gauzy/ui-sdk/core';
import { distinctUntilChange } from '@gauzy/common-angular';
import { EmployeeStore, Store } from './../../../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-edit-employee-networks',
	templateUrl: './edit-employee-networks.component.html',
	styleUrls: [
		'../../../../organizations/edit-organization/edit-organization-settings/edit-organization-main/edit-organization-main.component.scss',
		'./edit-employee-networks.component.scss'
	]
})
export class EditEmployeeNetworksComponent implements OnInit, OnDestroy {
	selectedEmployee: IEmployee;
	organization: IOrganization;

	public form: UntypedFormGroup = EditEmployeeNetworksComponent.buildForm(this.fb);
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		const form = fb.group(
			{
				linkedInUrl: [],
				facebookUrl: [],
				instagramUrl: [],
				twitterUrl: [],
				githubUrl: [],
				gitlabUrl: [],
				upworkUrl: [],
				stackoverflowUrl: []
			},
			{
				validators: [
					UrlPatternValidator.websiteUrlValidator('linkedInUrl'),
					UrlPatternValidator.websiteUrlValidator('facebookUrl'),
					UrlPatternValidator.websiteUrlValidator('instagramUrl'),
					UrlPatternValidator.websiteUrlValidator('twitterUrl'),
					UrlPatternValidator.websiteUrlValidator('githubUrl'),
					UrlPatternValidator.websiteUrlValidator('gitlabUrl'),
					UrlPatternValidator.websiteUrlValidator('upworkUrl')
				]
			}
		);
		return form;
	}

	constructor(
		private readonly fb: UntypedFormBuilder,
		private readonly store: Store,
		private readonly employeeStore: EmployeeStore
	) {}

	ngOnInit() {
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.employeeStore.selectedEmployee$;
		combineLatest([storeOrganization$, storeEmployee$])
			.pipe(
				distinctUntilChange(),
				filter(([organization, employee]) => !!organization && !!employee),
				tap(([organization, employee]) => {
					this.organization = organization;
					this.selectedEmployee = employee;
				}),
				tap(() => this._patchForm(this.selectedEmployee)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	protected _patchForm(employee: IEmployee) {
		if (!employee) {
			return;
		}
		const {
			linkedInUrl,
			facebookUrl,
			instagramUrl,
			twitterUrl,
			githubUrl,
			gitlabUrl,
			upworkUrl,
			stackoverflowUrl
		} = employee;
		this.form.patchValue({
			linkedInUrl,
			facebookUrl,
			instagramUrl,
			twitterUrl,
			githubUrl,
			gitlabUrl,
			upworkUrl,
			stackoverflowUrl
		});
	}

	submitForm() {
		if (this.form.invalid) {
			return;
		}
		const { id: organizationId } = this.store.selectedOrganization;
		this.employeeStore.employeeForm = {
			...this.form.getRawValue(),
			organizationId
		};
	}

	ngOnDestroy() {}
}
