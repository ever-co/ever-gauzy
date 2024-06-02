import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { UntypedFormGroup } from '@angular/forms';
import { NbDialogRef, NbStepperComponent, NbTagComponent } from '@nebular/theme';
import { filter, firstValueFrom, tap } from 'rxjs';
import { IEmployee, IUser, IEmployeeCreateInput, CrudActionEnum, IOrganization } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/ui-sdk/common';
import { ErrorHandlingService, OrganizationsService } from '@gauzy/ui-sdk/core';
import { EmployeesService, EmployeeStore, Store } from '../../../@core/services';
import { BasicInfoFormComponent } from '../../user/forms/basic-info/basic-info-form.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-employee-mutation',
	templateUrl: 'employee-mutation.component.html',
	styleUrls: ['employee-mutation.component.scss']
})
export class EmployeeMutationComponent implements OnInit, AfterViewInit {
	@ViewChild('userBasicInfo')
	userBasicInfo: BasicInfoFormComponent;

	@ViewChild('stepper')
	stepper: NbStepperComponent;

	loading: boolean = false;
	linear: boolean = true;
	form: UntypedFormGroup;
	employees: IEmployeeCreateInput[] = [];
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

	closeDialog(employee: IEmployee[] = null) {
		this.dialogRef.close(employee);
	}

	addEmployee() {
		if (!this.organization) {
			return;
		}
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;

		this.form = this.userBasicInfo.form;
		const { firstName, lastName, email, username, password, tags, imageUrl, imageId } = this.form.value;
		const {
			offerDate = null,
			acceptDate = null,
			rejectDate = null,
			startedWorkOn = null
		} = this.form.getRawValue();
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
		const employee: IEmployeeCreateInput = {
			user,
			startedWorkOn,
			password,
			organizationId,
			offerDate,
			acceptDate,
			rejectDate,
			tags
		};
		// Check form validity before to add an employee to the array of employees.
		if (this.form.valid) this.employees.push(employee);
		// Reset form and stepper.
		this.form.reset();
		this.stepper.reset();
	}

	async add() {
		if (!this.organization) {
			return;
		}
		this.addEmployee();
		try {
			this.loading = true;
			const employees = await firstValueFrom(this.employeesService.createBulk(this.employees)).finally(() => {
				this.loading = false;
			});
			this._employeeStore.employeeAction = {
				action: CrudActionEnum.CREATED,
				employees
			};
			this.closeDialog(employees);
		} catch (error) {
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
