import { Location } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Params } from '@angular/router';
import { Employee, EmployeeTypes } from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { EmployeesService } from '../../../../../@core/services/employees.service';
import { EmployeeStore } from '../../../../../@core/services/employee-store.service';

@Component({
	selector: 'ga-edit-employee-main',
	templateUrl: './edit-employee-main.component.html',
	styleUrls: [
		'../../../../organizations/edit-organization/edit-organization-settings/edit-organization-main/edit-organization-main.component.scss'
	]
})
export class EditEmployeeMainComponent implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	form: FormGroup;
	paramSubscription: Subscription;
	hoverState: boolean;
	routeParams: Params;
	selectedEmployee: Employee;
	fakeDepartments: { departmentName: string; departmentId: string }[] = [];
	fakePositions: { positionName: string; positionId: string }[] = [];
	employeeTypes: EmployeeTypes[];

	constructor(
		private fb: FormBuilder,
		private location: Location,
		private toastrService: NbToastrService,
		private employeeStore: EmployeeStore,
		private employeeService: EmployeesService
	) {}

	ngOnInit() {
		this.employeeStore.selectedEmployee$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((emp) => {
				this.selectedEmployee = emp;
				if (this.selectedEmployee) {
					this._initializeForm(this.selectedEmployee);
					this.employeeService
						.getEmpTypes(this.selectedEmployee.orgId)
						.pipe(takeUntil(this._ngDestroy$))
						.subscribe((data) => {
							this.employeeTypes = data;
						});
				}
			});
		this.getFakeData();
	}

	private getFakeId = () => (Math.floor(Math.random() * 101) + 1).toString();

	private getFakeData() {
		const fakeDepartmentNames = [
			'Accounting',
			'IT',
			'Marketing',
			'Human Resources'
		];

		fakeDepartmentNames.forEach((name) => {
			this.fakeDepartments.push({
				departmentName: name,
				departmentId: this.getFakeId()
			});
		});

		const fakePositionNames = [
			'Developer',
			'Project Manager',
			'Accounting Employee',
			'Head of Human Resources'
		];

		fakePositionNames.forEach((name) => {
			this.fakePositions.push({
				positionName: name,
				positionId: this.getFakeId()
			});
		});
	}

	handleImageUploadError(error: any) {
		this.toastrService.danger(error);
	}

	async submitForm() {
		if (this.form.valid) {
			this.employeeStore.userForm = {
				...this.form.value
			};
		}
	}

	private _initializeForm(employee: Employee) {
		// TODO: Implement Departments and Positions!
		this.form = this.fb.group({
			username: [employee.user.username],
			email: [employee.user.email, Validators.required],
			firstName: [employee.user.firstName, Validators.required],
			lastName: [employee.user.lastName, Validators.required],
			imageUrl: [employee.user.imageUrl, Validators.required],
			employeeTypes: [['']]
		});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
