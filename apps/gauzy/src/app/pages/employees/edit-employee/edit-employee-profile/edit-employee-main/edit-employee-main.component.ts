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
    // The organisation page's `edit-organization-main.component.scss` used to be
    // loaded ahead of this one. It was written for a different page — a 563px
    // panel, a `w-25`/`w-75` split, a `height: 100%` chain and a rule painting
    // every div in the photo box solid black — so the tab's own stylesheet spent
    // itself overriding it, selector for selector, winning only on source order.
    // This tab owns its layout now.
    styleUrls: ['./edit-employee-main.component.scss'],
    standalone: false
})
export class EditEmployeeMainComponent implements OnInit, OnDestroy {
	organization: IOrganization;
	hoverState: boolean;
	selectedEmployee: IEmployee;

	/**
	 * Set when the avatar `<img>` raises `error`, i.e. when the employee HAS a
	 * stored photo URL but it does not resolve — a deleted asset, an expired
	 * signed URL, a host that is down. Guarding on the URL alone only proved one
	 * was set, so those employees got the browser's broken-image glyph where the
	 * avatar belongs; this switches them to the same placeholder an employee with
	 * no photo at all gets. Reset wherever the URL can change.
	 */
	avatarFailed = false;

	/**
	 * Where the employee stands in their engagement, from the two dates the
	 * Employment and Hiring tabs write. Derived rather than stored: `endWork`
	 * being set is what "work ended" means, and no `startedWorkOn` is what the
	 * employee list already calls "Not Started" (it is also what makes an employee
	 * invisible to accounts and split expenses — see EMPLOYEES_PAGE.NOT_STARTED_HELP).
	 */
	get workState(): 'active' | 'ended' | 'not-started' | null {
		const employee = this.selectedEmployee;
		if (!employee) return null;
		if (employee.endWork) return 'ended';
		return employee.startedWorkOn ? 'active' : 'not-started';
	}

	/**
	 * Whether the panel has anything to put under each caption. A caption with no
	 * rows under it is worse than no caption, and every one of these fields is
	 * optional on the record.
	 */
	get hasEmploymentFacts(): boolean {
		const employee = this.selectedEmployee;
		return !!(employee?.employeeLevel || employee?.startedWorkOn || employee?.endWork);
	}

	get hasRateFacts(): boolean {
		const employee = this.selectedEmployee;
		return !!(
			employee?.payPeriod ||
			(employee?.billRateCurrency && employee?.billRateValue) ||
			employee?.reWeeklyLimit
		);
	}

	get hasJobFacts(): boolean {
		const employee = this.selectedEmployee;
		return !!(employee?.jobSuccess || employee?.totalJobs);
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
				// A freshly uploaded asset is a URL that has not been tried yet.
				this.avatarFailed = false;
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
		// A different employee means a different URL to try; the previous one's
		// failure says nothing about this one.
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
