import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { ActivatedRoute, Params } from '@angular/router';
import {
	IEmployee,
	IEmployeeUpdateInput,
	IUserUpdateInput
} from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslationBaseComponent } from '../../../../@shared/language-base/translation-base.component';
import { EmployeesService, EmployeeStore, ErrorHandlingService, ToastrService, UsersService } from './../../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-edit-employee-profile',
	templateUrl: './edit-employee-profile.component.html',
	styleUrls: [
		'../../../../@shared/user/edit-profile-form/edit-profile-form.component.scss'
	],
	providers: [EmployeeStore]
})
export class EditEmployeeProfileComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {

	form: FormGroup;
	paramSubscription: Subscription;
	hoverState: boolean;
	routeParams: Params;
	selectedEmployee: IEmployee;
	employeeName = 'Employee';
	tabs: any[];

	constructor(
		private route: ActivatedRoute,
		private employeeService: EmployeesService,
		private userService: UsersService,
		private toastrService: ToastrService,
		private employeeStore: EmployeeStore,
		private errorHandler: ErrorHandlingService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.route.params
			.pipe(untilDestroyed(this))
			.subscribe(async (params) => {
				this.routeParams = params;
				await this._loadEmployeeData();
				this.loadTabs();
			});
		this.employeeStore.userForm$
			.pipe(untilDestroyed(this))
			.subscribe((value) => {
				this.submitUserForm(value);
			});
		this.employeeStore.employeeForm$
			.pipe(untilDestroyed(this))
			.subscribe((value) => {
				this.submitEmployeeForm(value);
			});
		this._applyTranslationOnTabs();
	}

	getRoute(tab: string): string {
		return `/pages/employees/edit/${this.routeParams.id}/${tab}`;
	}

	loadTabs() {
		this.tabs = [
			{
				title: this.getTranslation(
					'EMPLOYEES_PAGE.EDIT_EMPLOYEE.ACCOUNT'
				),
				icon: 'person-outline',
				responsive: true,
				route: this.getRoute('account')
			},
			{
				title: this.getTranslation(
					'EMPLOYEES_PAGE.EDIT_EMPLOYEE.NETWORKS'
				),
				icon: 'at-outline',
				responsive: true,
				route: this.getRoute('networks')
			},
			{
				title: this.getTranslation(
					'EMPLOYEES_PAGE.EDIT_EMPLOYEE.EMPLOYMENT'
				),
				icon: 'browser-outline',
				responsive: true,
				route: this.getRoute('employment')
			},
			{
				title: this.getTranslation(
					'EMPLOYEES_PAGE.EDIT_EMPLOYEE.HIRING'
				),
				icon: 'map-outline',
				responsive: true,
				route: this.getRoute('hiring')
			},
			{
				title: this.getTranslation(
					'EMPLOYEES_PAGE.EDIT_EMPLOYEE.LOCATION'
				),
				icon: 'pin-outline',
				responsive: true,
				route: this.getRoute('location')
			},
			{
				title: this.getTranslation(
					'EMPLOYEES_PAGE.EDIT_EMPLOYEE.RATES'
				),
				icon: 'pricetags-outline',
				responsive: true,
				route: this.getRoute('rates')
			},
			{
				title: this.getTranslation(
					'EMPLOYEES_PAGE.EDIT_EMPLOYEE.PROJECTS'
				),
				icon: 'book-outline',
				responsive: true,
				route: this.getRoute('projects')
			},
			{
				title: this.getTranslation(
					'EMPLOYEES_PAGE.EDIT_EMPLOYEE.CONTACTS'
				),
				icon: 'book-open-outline',
				responsive: true,
				route: this.getRoute('contacts')
			}
		];
	}
	private async submitEmployeeForm(value: IEmployeeUpdateInput) {
		if (value) {
			try {
				await this.employeeService.update(
					this.selectedEmployee.id,
					value
				);

				this.toastrService.success(
					'TOASTR.MESSAGE.EMPLOYEE_PROFILE_UPDATE',
					{ name: this.employeeName }
				);
				await this._loadEmployeeData();
			} catch (error) {
				this.errorHandler.handleError(error);
			}
		}
	}

	/**
	 * This is to update the User details of an Employee.
	 * Do NOT use this function to update any details which are NOT stored in the User Entity.
	 */
	private async submitUserForm(value: IUserUpdateInput) {
		if (value) {
			try {
				await this.userService.update(
					this.selectedEmployee.user.id,
					value
				);

				this.toastrService.success(
					'TOASTR.MESSAGE.EMPLOYEE_PROFILE_UPDATE',
					{ name: this.employeeName }
				);

				await this._loadEmployeeData();
			} catch (error) {
				this.errorHandler.handleError(error);
			}
		}
	}

	private async _loadEmployeeData() {
		const { id } = this.routeParams;
		const employee = await this.employeeService.getEmployeeById(id, [
			'user',
			'organizationDepartments',
			'organizationPosition',
			'organizationEmploymentTypes',
			'tags',
			'skills',
			'contact'
		]);

		this.selectedEmployee = employee;
		const checkUsername = this.selectedEmployee.user.username;
		this.employeeName = checkUsername ? checkUsername : 'Employee';
		this.employeeStore.selectedEmployee = this.selectedEmployee;
	}

	ngOnDestroy() {}

	private _applyTranslationOnTabs() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this.loadTabs()),
				untilDestroyed(this)
			)
			.subscribe();
	}
}
