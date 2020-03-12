import { Location } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute, Params } from '@angular/router';
import { NbToastrService } from '@nebular/theme';
import { EmployeeStore } from 'apps/gauzy/src/app/@core/services/employee-store.service';
import { EmployeesService } from 'apps/gauzy/src/app/@core/services/employees.service';
import { UsersService } from 'apps/gauzy/src/app/@core/services/users.service';
import { Subject, Subscription } from 'rxjs';
import { first, takeUntil } from 'rxjs/operators';
import { EmployeeUpdateInput, Employee, UserUpdateInput } from '@gauzy/models';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { ErrorHandlingService } from 'apps/gauzy/src/app/@core/services/error-handling.service';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';

@Component({
	selector: 'ngx-edit-employee-profile',
	templateUrl: './edit-employee-profile.component.html',
	styleUrls: [
		'../../../../@shared/user/edit-profile-form/edit-profile-form.component.scss'
	],
	providers: [EmployeeStore]
})
export class EditEmployeeProfileComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	form: FormGroup;
	paramSubscription: Subscription;
	hoverState: boolean;
	fakeDepartments: { departmentName: string; departmentId: string }[] = [];
	fakePositions: { positionName: string; positionId: string }[] = [];
	routeParams: Params;
	selectedEmployee: Employee;
	employeeName = 'Employee';

	tabs: any[];

	constructor(
		private route: ActivatedRoute,
		private fb: FormBuilder,
		private location: Location,
		private employeeService: EmployeesService,
		private userService: UsersService,
		private toastrService: NbToastrService,
		private employeeStore: EmployeeStore,
		private errorHandler: ErrorHandlingService,
		private store: Store,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.route.params
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((params) => {
				this.routeParams = params;
				this._loadEmployeeData();
			});

		this.employeeStore.userForm$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((value) => {
				this.submitUserForm(value);
			});

		this.employeeStore.employeeForm$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((value) => {
				this.submitEmployeeForm(value);
			});

		this.loadTabs();
	}

	loadTabs() {
		this.tabs = [
			{
				title: 'Main',
				icon: 'person-outline',
				responsive: true,
				route: `/pages/employees/edit/${this.routeParams.id}/profile/main`
			},
			{
				title: 'Location',
				icon: 'pin-outline',
				responsive: true,
				route: `/pages/employees/edit/${this.routeParams.id}/profile/location`
			},
			{
				title: 'Rates',
				icon: 'pricetags-outline',
				responsive: true,
				route: `/pages/employees/edit/${this.routeParams.id}/profile/rates`
			},
			{
				title: 'Departments',
				icon: 'briefcase-outline',
				responsive: true,
				route: `/pages/employees/edit/${this.routeParams.id}/profile/departments`
			},
			{
				title: 'Projects',
				icon: 'book-outline',
				responsive: true,
				route: `/pages/employees/edit/${this.routeParams.id}/profile/projects`
			},
			{
				title: 'Clients',
				icon: 'book-open-outline',
				responsive: true,
				route: `/pages/employees/edit/${this.routeParams.id}/profile/clients`
			},
			{
				title: 'Hiring',
				icon: 'map-outline',
				responsive: true,
				route: `/pages/employees/edit/${this.routeParams.id}/profile/hiring`
			}
		];
	}

	goBack() {
		this.location.back();
	}

	private async submitEmployeeForm(value: EmployeeUpdateInput) {
		if (value) {
			try {
				await this.employeeService.update(
					this.selectedEmployee.id,
					value
				);
				this.toastrService.primary(
					this.getTranslation(
						'TOASTR.MESSAGE.EMPLOYEE_PROFILE_UPDATE',
						{ name: this.employeeName }
					),
					this.getTranslation('TOASTR.TITLE.SUCCESS')
				);
				this._loadEmployeeData();
			} catch (error) {
				this.errorHandler.handleError(error);
			}
		}
	}

	private async submitUserForm(value: UserUpdateInput) {
		if (value) {
			try {
				const organizationDepartment = value.organizationDepartment;
				delete value.organizationDepartment;

				const organizationPosition = value.organizationPosition;
				delete value.organizationPosition;

				await this.userService.update(
					this.selectedEmployee.user.id,
					value
				);

				this.employeeStore.employeeForm = {
					organizationDepartment,
					organizationPosition
				};

				this._loadEmployeeData();
			} catch (error) {
				this.errorHandler.handleError(error);
			}
		}
	}

	private async _loadEmployeeData() {
		const { id } = this.routeParams;
		const { items } = await this.employeeService
			.getAll(
				['user', 'organizationDepartment', 'organizationPosition'],
				{ id }
			)
			.pipe(first())
			.toPromise();

		this.selectedEmployee = items[0];
		const checkUsername = this.selectedEmployee.user.username;
		this.employeeName = checkUsername ? checkUsername : 'Employee';

		this.employeeStore.selectedEmployee = this.selectedEmployee;
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
