import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { IEmployee, IOrganization } from '@gauzy/contracts';
import { combineLatest } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/common-angular';
import { EmployeeStore, Store } from './../../../../../@core/services';
import { UrlPatternValidator } from './../../../../../@core/validators';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-edit-employee-networks',
	templateUrl: './edit-employee-networks.component.html',
	styleUrls: [
		'../../../../organizations/edit-organization/edit-organization-settings/edit-organization-main/edit-organization-main.component.scss'
	]
})
export class EditEmployeeNetworksComponent implements OnInit, OnDestroy {
	selectedEmployee: IEmployee;
	organization: IOrganization;

	public form: FormGroup = EditEmployeeNetworksComponent.buildForm(this.fb);
	static buildForm(formBuilder: FormBuilder): FormGroup {
		const form = formBuilder.group({
			linkedInUrl: ['', [UrlPatternValidator.urlAbstractValidator]],
			facebookUrl: ['', [UrlPatternValidator.urlAbstractValidator]],
			instagramUrl: ['', [UrlPatternValidator.urlAbstractValidator]],
			twitterUrl: ['', [UrlPatternValidator.urlAbstractValidator]],
			githubUrl: ['', [UrlPatternValidator.urlAbstractValidator]],
			gitlabUrl: ['', [UrlPatternValidator.urlAbstractValidator]],
			upworkUrl: ['', [UrlPatternValidator.urlAbstractValidator]]
		});
		return form;
	}

	constructor(
		private readonly fb: FormBuilder,
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
		const { linkedInUrl, facebookUrl, instagramUrl, twitterUrl, githubUrl, gitlabUrl, upworkUrl } = employee;
		this.form.patchValue({
			linkedInUrl,
			facebookUrl,
			instagramUrl,
			twitterUrl,
			githubUrl,
			gitlabUrl,
			upworkUrl
		});
	}

	submitForm() {
		if (this.form.invalid) {
			return;
		}
		this.employeeStore.employeeForm = {
			...this.selectedEmployee,
			...this.form.getRawValue()
		};
	}

	ngOnDestroy() {}
}
