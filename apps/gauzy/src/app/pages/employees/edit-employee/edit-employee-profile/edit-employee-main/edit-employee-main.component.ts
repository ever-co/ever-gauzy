import { Component, OnDestroy, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { IEmployee, IImageAsset, IOrganization } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { Store } from '@gauzy/ui-core/core';
import { EmployeeStore, ErrorHandlingService } from '@gauzy/ui-core/core';

/**
 * This component contains the properties stored within the User Entity of an Employee.
 * Any property which is either stored directly in the Employee entity or as a relation of the Employee entity should NOT be put in this Component
 */
@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-edit-employee-main',
    templateUrl: './edit-employee-main.component.html',
    styleUrls: [
        '../../../../organizations/edit-organization/edit-organization-settings/edit-organization-main/edit-organization-main.component.scss',
        './edit-employee-main.component.scss'
    ],
    standalone: false
})
export class EditEmployeeMainComponent implements OnInit, OnDestroy {
	organization: IOrganization;
	hoverState: boolean;
	selectedEmployee: IEmployee;

	/*
	 * Employee Main Mutation Form
	 */
	public form: UntypedFormGroup = EditEmployeeMainComponent.buildForm(this._fb);
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			username: [],
			email: [null, Validators.required],
			firstName: [],
			lastName: [],
			preferredLanguage: [],
			profile_link: [],
			imageId: [],
			imageUrl: [{ value: null, disabled: true }]
		});
	}

	constructor(
		private readonly _fb: UntypedFormBuilder,
		private readonly _store: Store,
		private readonly _employeeStore: EmployeeStore,
		private readonly _errorHandlingService: ErrorHandlingService
	) {}

	ngOnInit() {
		const storeOrganization$ = this._store.selectedOrganization$;
		const storeEmployee$ = this._employeeStore.selectedEmployee$;
		combineLatest([storeOrganization$, storeEmployee$])
			.pipe(
				filter(([organization, employee]) => !!organization && !!employee),
				tap(([organization, employee]) => {
					this.organization = organization;
					this.selectedEmployee = employee;
				}),
				tap(() => this._initializeFormValue(this.selectedEmployee)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Handles errors that occur during image upload.
	 *
	 * @param error - The error object to handle.
	 */
	handleImageUploadError(error: any) {
		// Delegate error handling to the _errorHandlingService
		this._errorHandlingService.handleError(error);
	}

	/**
	 * Upload employee image/avatar
	 *
	 * @param image
	 */
	async updateImageAsset(image: IImageAsset) {
		try {
			if (image) {
				// Update user form data in store (assuming updateUserForm is async)
				await this._employeeStore.updateUserForm({
					imageId: image.id,
					image
				});
			}
		} catch (error) {
			// Handle and log errors
			this._errorHandlingService.handleError(error);
		}
	}

	/**
	 * Submit employee main profile
	 *
	 * @returns
	 */
	async submitForm() {
		if (this.form.invalid || !this.organization) {
			return;
		}
		const { id: organizationId, tenantId } = this.organization;

		const values = {
			organizationId,
			tenantId,
			...(this.form.valid ? this.form.value : {})
		};

		// Update user form data in store (assuming updateUserForm is async)
		await this._employeeStore.updateUserForm(values);
		await this._employeeStore.updateEmployeeForm(values);
	}

	/**
	 * Initialize the form values with the given employee's data.
	 *
	 * @param employee - The employee whose data will be used to initialize the form.
	 */
	private _initializeFormValue(employee: IEmployee) {
		// Patch the form with the employee's user data
		this.form.patchValue({
			username: employee.user.username,
			email: employee.user.email,
			firstName: employee.user.firstName,
			lastName: employee.user.lastName,
			imageUrl: employee.user.image?.fullUrl || employee.user.imageUrl,
			imageId: employee.user.imageId,
			preferredLanguage: employee.user.preferredLanguage,
			profile_link: employee.profile_link
		});
	}

	ngOnDestroy() {}
}
