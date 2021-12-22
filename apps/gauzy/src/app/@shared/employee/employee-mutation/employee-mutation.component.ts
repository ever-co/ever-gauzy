import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { NbDialogRef, NbStepperComponent } from '@nebular/theme';
import { BasicInfoFormComponent } from '../../user/forms/basic-info/basic-info-form.component';
import {
	RolesEnum,
	IEmployee,
	IUser,
	IRole,
	IEmployeeCreateInput,
	CrudActionEnum
} from '@gauzy/contracts';
import { firstValueFrom } from 'rxjs';
import {
	EmployeesService,
	EmployeeStore,
	ErrorHandlingService,
	OrganizationsService,
	RoleService,
	Store
} from '../../../@core/services';

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
	form: FormGroup;
	role: IRole;
	employees: IEmployeeCreateInput[] = [];

	constructor(
		protected dialogRef: NbDialogRef<EmployeeMutationComponent>,
		protected organizationsService: OrganizationsService,
		protected employeesService: EmployeesService,
		private readonly roleService: RoleService,
		protected store: Store,
		private errorHandler: ErrorHandlingService,
		private readonly _employeeStore: EmployeeStore
	) {}

	ngOnInit(): void {}

	async ngAfterViewInit() {
		const { tenantId } = this.store.user;
		this.form = this.userBasicInfo.form;
		this.role = await firstValueFrom(
			this.roleService.getRoleByName({
				name: RolesEnum.EMPLOYEE,
				tenantId
			})
		);
	}

	closeDialog(employee: IEmployee[] = null) {
		this.dialogRef.close(employee);
	}

	addEmployee() {
		const user: IUser = {
			username: this.form.get('username').value,
			firstName: this.form.get('firstName').value,
			lastName: this.form.get('lastName').value,
			email: this.form.get('email').value,
			imageUrl: this.form.get('imageUrl').value,
			tenant: null,
			role: this.role,
			tags: this.form.get('tags').value
		};

		const offerDate = this.form.get('offerDate').value || null;
		const acceptDate = this.form.get('acceptDate').value || null;
		const rejectDate = this.form.get('rejectDate').value || null;

		const newEmployee: IEmployeeCreateInput = {
			user,
			startedWorkOn: this.form.get('startedWorkOn').value || null,
			password: this.form.get('password').value,
			organization: this.store.selectedOrganization,
			offerDate,
			acceptDate,
			rejectDate,
			tags: this.form.get('tags').value
		};
		this.employees.push(newEmployee);
		this.userBasicInfo.loadFormData();
		this.form = this.userBasicInfo.form;
		this.stepper.reset();
	}

	async add() {
		this.addEmployee();
		try {
			const employees =  await firstValueFrom(
				this.employeesService.createBulk(this.employees)
			);
			this._employeeStore.employeeAction = {
				action: CrudActionEnum.CREATED,
				employees
			};
			this.closeDialog(employees);
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	}
}
