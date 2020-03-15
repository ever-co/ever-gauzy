import { Location } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute, Params } from '@angular/router';
import { Employee, EmployeeUpdateInput, UserUpdateInput } from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { EmployeeStore } from 'apps/gauzy/src/app/@core/services/employee-store.service';
import { EmployeesService } from 'apps/gauzy/src/app/@core/services/employees.service';
import { ErrorHandlingService } from 'apps/gauzy/src/app/@core/services/error-handling.service';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { UsersService } from 'apps/gauzy/src/app/@core/services/users.service';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { Subject, Subscription } from 'rxjs';
import { first, takeUntil } from 'rxjs/operators';

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

	getRoute(tab: string): string {
		return `/pages/employees/edit/${this.routeParams.id}/profile/${tab}`;
	}

	loadTabs() {
		this.tabs = [
			{
				title: 'Account',
				icon: 'person-outline',
				responsive: true,
				route: this.getRoute('account')
			},
			{
				title: 'Employment',
				icon: 'browser-outline',
				responsive: true,
				route: this.getRoute('employment')
			},
			{
				title: 'Location',
				icon: 'pin-outline',
				responsive: true,
				route: this.getRoute('location')
			},
			{
				title: 'Rates',
				icon: 'pricetags-outline',
				responsive: true,
				route: this.getRoute('rates')
			},
			{
				title: 'Projects',
				icon: 'book-outline',
				responsive: true,
				route: this.getRoute('projects')
			},
			{
				title: 'Clients',
				icon: 'book-open-outline',
				responsive: true,
				route: this.getRoute('clients')
			},
			{
				title: 'Hiring',
				icon: 'map-outline',
				responsive: true,
				route: this.getRoute('hiring')
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

	/**
	 * This is to update the User details of an Employee.
	 * Do NOT use this function to update any details which are NOT stored in the User Entity.
	 */
	private async submitUserForm(value: UserUpdateInput) {
		if (value) {
			try {
				await this.userService.update(
					this.selectedEmployee.user.id,
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

	private async _loadEmployeeData() {
		const { id } = this.routeParams;
		const { items } = await this.employeeService
			.getAll(
				[
					'user',
					'organizationDepartments',
					'organizationPosition',
					'organizationEmploymentTypes'
				],
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
