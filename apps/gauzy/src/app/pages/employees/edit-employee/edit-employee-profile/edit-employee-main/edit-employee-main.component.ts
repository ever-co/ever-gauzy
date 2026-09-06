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
    styleUrls: ['./edit-employee-main.component.scss'],
    standalone: false
})
export class EditEmployeeMainComponent implements OnInit, OnDestroy {
	organization: IOrganization;
	hoverState: boolean;
	selectedEmployee: IEmployee;

	avatarFailed = false;

	get workState(): 'active' | 'ended' | 'not-started' | null {
		const employee = this.selectedEmployee;
		if (!employee) return null;
		if (employee.endWork) return 'ended';
		return employee.startedWorkOn ? 'active' : 'not-started';
	}

	get hasEmploymentFacts(): boolean {
		const employee = this.selectedEmployee;
		return !!(employee?.employeeLevel || employee?.startedWorkOn || employee?.endWork);
	}

	get hasRateFacts(): boolean {
		const employee = this.selectedEmployee;
		return !!(
			employee?.payPeriod ||
			(employee?.billRateCurrency && employee?.billRateValue != null) ||
			employee?.reWeeklyLimit != null
		);
	}

	get hasJobFacts(): boolean {
		const employee = this.selectedEmployee;
		return employee?.jobSuccess != null || employee?.totalJobs != null;
	}

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
				this.avatarFailed = false;
				// The store round-trip does come back here — userForm$ drives the user
				// update, whose `finally` refetches the employee and re-emits
				// selectedEmployee$, which re-runs _initializeFormValue. But that is a
				// whole request away, and `imageUrl` is what the <img> binds to, so
				// patch it now rather than showing the old avatar until the reload
				// lands. `imageId` goes with it: submitForm() posts the form value, so
				// saving before the reload would otherwise revert to the old asset.
				this.form.patchValue({
					imageId: image.id,
					imageUrl: image.fullUrl || image.url
				});
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
		this.avatarFailed = false;
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
