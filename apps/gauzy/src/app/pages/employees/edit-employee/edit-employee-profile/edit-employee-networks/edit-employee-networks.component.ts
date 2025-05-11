import { Component, OnDestroy, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { combineLatest } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IEmployee, IOrganization } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { EmployeeStore, Store, UrlPatternValidator } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-edit-employee-networks',
    templateUrl: './edit-employee-networks.component.html',
    styleUrls: [
        '../../../../organizations/edit-organization/edit-organization-settings/edit-organization-main/edit-organization-main.component.scss',
        './edit-employee-networks.component.scss'
    ],
    standalone: false
})
export class EditEmployeeNetworksComponent implements OnInit, OnDestroy {
	selectedEmployee: IEmployee;
	organization: IOrganization;

	// Mutation Form
	public form: UntypedFormGroup = this.fb.group(
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
	/**
	 * Patches the form with employee's URL values.
	 * @param employee - The employee object containing URL properties to patch the form.
	 */
	private _patchForm(employee: IEmployee): void {
		if (!employee) {
			return;
		}

		// Extract and prepare URL fields with default empty string if undefined
		const {
			linkedInUrl = '',
			facebookUrl = '',
			instagramUrl = '',
			twitterUrl = '',
			githubUrl = '',
			gitlabUrl = '',
			upworkUrl = '',
			stackoverflowUrl = ''
		} = employee;

		// Patch form with extracted values
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

	/**
	 * Submits the form by setting the employee form values in the employee store.
	 * If the form is invalid, it stops execution.
	 */
	public submitForm(): void {
		try {
			// Check if the form is valid
			if (this.form.invalid) {
				// Optionally, you might want to add some user feedback or logging here
				return;
			}

			// Extract organization ID from the selected organization in the store
			const { id: organizationId, tenantId } = this.store.selectedOrganization;

			// Update the employee form in the employee store with form values and organization ID
			this.employeeStore.employeeForm = {
				...this.form.value,
				organizationId,
				tenantId
			};
		} catch (error) {
			// Optionally, you might want to add some user feedback or logging here
			console.error('Error while submitting form:', error);
		}
	}

	ngOnDestroy(): void {}
}
