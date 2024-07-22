import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { UntypedFormGroup } from '@angular/forms';
import { NbDialogRef, NbStepperComponent, NbTagComponent } from '@nebular/theme';
import { filter, firstValueFrom, tap } from 'rxjs';
import { IEmployee, IUser, IEmployeeCreateInput, CrudActionEnum, IOrganization } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange, Store } from '@gauzy/ui-core/common';
import { EmployeeStore, EmployeesService, ErrorHandlingService, OrganizationsService } from '@gauzy/ui-core/core';
import { BasicInfoFormComponent } from '../../user/forms';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-employee-mutation',
	templateUrl: 'employee-mutation.component.html',
	styleUrls: ['employee-mutation.component.scss']
})
export class EmployeeMutationComponent implements OnInit, AfterViewInit {
	@ViewChild('userBasicInfo') userBasicInfo: BasicInfoFormComponent;
	@ViewChild('stepper') stepper: NbStepperComponent;

	loading: boolean = false;
	linear: boolean = true;
	form: UntypedFormGroup;
	public employees: IEmployeeCreateInput[] = [];
	public organization: IOrganization;

	constructor(
		protected readonly dialogRef: NbDialogRef<EmployeeMutationComponent>,
		protected readonly organizationsService: OrganizationsService,
		protected readonly employeesService: EmployeesService,
		protected readonly store: Store,
		private readonly errorHandler: ErrorHandlingService,
		private readonly _employeeStore: EmployeeStore
	) {}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit(): void {
		this.form = this.userBasicInfo.form;
	}

	/**
	 * Closes the dialog window.
	 *
	 * @param employee An optional array of employees to pass back to the caller.
	 */
	closeDialog(employee: IEmployee[] | null = null): void {
		this.dialogRef.close(employee);
	}

	/**
	 * Adds an employee to the employees array based on form input.
	 * Resets the form and stepper after adding the employee.
	 */
	addEmployee(): void {
		// Ensure organization is defined
		if (!this.organization) {
			return;
		}

		// Extract necessary data from organization and user store
		const { id: organizationId, tenantId } = this.organization;

		// Retrieve form values
		const { firstName, lastName, email, username, password, tags, imageUrl, imageId } = this.form.value;
		const { offerDate = null, acceptDate = null, rejectDate = null, startedWorkOn = null } = this.form.value;

		// Prepare user object
		const user: IUser = {
			firstName,
			lastName,
			username,
			email,
			imageUrl,
			imageId,
			tenantId,
			tags
		};

		// Prepare employee input object
		const employee: IEmployeeCreateInput = {
			user,
			startedWorkOn,
			password,
			organizationId,
			organization: { id: organizationId },
			offerDate,
			acceptDate,
			rejectDate,
			tags
		};

		// Add employee to the array if form is valid
		if (this.form.valid) {
			this.employees.push(employee);
		}

		// Reset form and stepper after adding employee
		this.form.reset();
		this.stepper.reset();
	}

	/**
	 * Adds multiple employees and handles the process of creation.
	 * Closes the dialog upon successful creation or handles errors.
	 */
	async add() {
		// Check if organization is defined
		if (!this.organization) {
			return;
		}

		// Add employee based on form input
		this.addEmployee();

		try {
			// Set loading state to true
			this.loading = true;
			// Create employees in bulk using service
			const employees: IEmployee[] = await firstValueFrom(this.employeesService.createBulk(this.employees));
			this.loading = false; // Set loading state to false regardless of success or failure

			// Update employee action in store
			this._employeeStore.employeeAction = {
				action: CrudActionEnum.CREATED,
				employees
			};

			// Close dialog with created employees
			this.closeDialog(employees);
		} catch (error) {
			// Handle errors using error handler service
			this.errorHandler.handleError(error);
		}
	}

	/**
	 * Removed one employee in the array of employees.
	 * @param tag
	 */
	onEmployeeRemove(tag: NbTagComponent): void {
		this.employees = this.employees.filter((t: IEmployeeCreateInput) => t.user.email !== tag.text);
	}

	/**
	 * Go to the next step without saving the data even if the form is valid.
	 */
	nextStep() {
		this.form.reset();
		this.stepper.next();
	}
}
