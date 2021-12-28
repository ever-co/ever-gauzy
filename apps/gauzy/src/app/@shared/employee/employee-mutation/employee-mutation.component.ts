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
	CrudActionEnum,
	IOrganization
} from '@gauzy/contracts';
import { filter, firstValueFrom, tap } from 'rxjs';
import {
	EmployeesService,
	EmployeeStore,
	ErrorHandlingService,
	OrganizationsService,
	RoleService,
	Store
} from '../../../@core/services';
import { distinctUntilChange } from 'packages/common-angular/dist';
import { untilDestroyed } from '@ngneat/until-destroy';

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
	organization: IOrganization;
	
	constructor(
		protected readonly dialogRef: NbDialogRef<EmployeeMutationComponent>,
		protected readonly organizationsService: OrganizationsService,
		protected readonly employeesService: EmployeesService,
		private readonly roleService: RoleService,
		protected readonly store: Store,
		private readonly errorHandler: ErrorHandlingService,
		private readonly _employeeStore: EmployeeStore
	) {}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization) => !!organization),
				tap((organization) => this.organization = organization),
				untilDestroyed(this)
			)
			.subscribe();
	}

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
		this.form = this.userBasicInfo.form;
		
		const { firstName, lastName, email, username, password, tags, imageUrl } = this.form.getRawValue();
		const { offerDate = null, acceptDate = null, rejectDate = null, startedWorkOn = null } = this.form.getRawValue();
		const user: IUser = {
			firstName: firstName,
			lastName: lastName,
			username,
			email: email,
			imageUrl: imageUrl,
			tenant: null,
			role: this.role,
			tags: tags
		};
		const employee: IEmployeeCreateInput = {
			user,
			startedWorkOn: startedWorkOn,
			password: password,
			organization: this.organization,
			offerDate,
			acceptDate,
			rejectDate,
			tags: tags
		};
		this.employees.push(employee);
		this.form.reset();
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