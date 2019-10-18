import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Location } from '@angular/common';
import { EmployeesService } from 'apps/gauzy/src/app/@core/services/employees.service';
import { first, takeUntil } from 'rxjs/operators';
import { Employee } from '@gauzy/models';
import { Subject, Subscription } from 'rxjs';
import { UsersService } from 'apps/gauzy/src/app/@core/services/users.service';
import { NbToastrService } from '@nebular/theme';

@Component({
	selector: 'ngx-edit-employee-profile',
	templateUrl: './edit-employee-profile.component.html',
	styleUrls: ['./edit-employee-profile.component.scss']
})
export class EditEmployeeProfileComponent implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	form: FormGroup;
	paramSubscription: Subscription;
	hoverState: boolean;
	fakeDepartments: { departmentName: string; departmentId: string }[] = [];
	fakePositions: { positionName: string; positionId: string }[] = [];
	routeParams: Params;
	selectedEmployee: Employee;
	employeeName = 'Employee';

	constructor(
		private route: ActivatedRoute,
		private fb: FormBuilder,
		private location: Location,
		private employeeService: EmployeesService,
		private userService: UsersService,
		private toastrService: NbToastrService
	) {}

	ngOnInit() {
		this.route.params
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((params) => {
				this.routeParams = params;
				this._loadEmployeeData();
			});

		this.getFakeData();
	}

	goBack() {
		this.location.back();
	}

	handleImageUploadError(error: any) {
		this.toastrService.danger(error);
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

	async submitForm() {
		if (this.form.valid) {
			try {
				this.userService.update(
					this.selectedEmployee.user.id,
					this.form.value
				);
				this.toastrService.primary(
					this.employeeName + ' profile updated.',
					'Success'
				);
				this._loadEmployeeData();
			} catch (error) {
				this.toastrService.danger(
					error.error.message || error.message,
					'Error'
				);
			}
		}
	}

	private async _loadEmployeeData() {
		const { id } = this.routeParams;
		const { items } = await this.employeeService
			.getAll(['user'], { id })
			.pipe(first())
			.toPromise();

		this.selectedEmployee = items[0];
		const checkUsername = this.selectedEmployee.user.username;
		this.employeeName = checkUsername ? checkUsername : 'Employee';
		this._initializeForm(items[0]);
	}

	private _initializeForm(employee: Employee) {
		// TODO: Implement Departments and Positions!
		this.form = this.fb.group({
			username: [employee.user.username],
			email: [employee.user.email, Validators.required],
			firstName: [employee.user.firstName, Validators.required],
			lastName: [employee.user.lastName, Validators.required],
			imageUrl: [employee.user.imageUrl, Validators.required]
		});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
