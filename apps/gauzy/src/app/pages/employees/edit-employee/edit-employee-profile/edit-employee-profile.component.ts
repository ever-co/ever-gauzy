import { Component, OnDestroy, OnInit, Output, EventEmitter } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import { IEmployee, IEmployeeUpdateInput, IUserUpdateInput, PermissionsEnum } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom, Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/i18n';
import { Store } from '@gauzy/ui-sdk/common';
import { ErrorHandlingService, ToastrService, UsersService } from '@gauzy/ui-sdk/core';
import { EmployeesService, EmployeeStore } from '@gauzy/ui-sdk/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-edit-employee-profile',
	templateUrl: './edit-employee-profile.component.html',
	styleUrls: [
		'./edit-employee-profile.component.scss',
		'../../../../@shared/user/edit-profile-form/edit-profile-form.component.scss'
	],
	providers: [EmployeeStore]
})
export class EditEmployeeProfileComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	routeParams: Params;
	selectedEmployee: IEmployee;
	employeeName: string;
	tabs: any[] = [];
	subject$: Subject<any> = new Subject();

	@Output()
	updatedImage = new EventEmitter<any>();

	constructor(
		private readonly route: ActivatedRoute,
		private readonly employeeService: EmployeesService,
		private readonly userService: UsersService,
		private readonly toastrService: ToastrService,
		private readonly employeeStore: EmployeeStore,
		private readonly errorHandler: ErrorHandlingService,
		public readonly translateService: TranslateService,
		private readonly store: Store
	) {
		super(translateService);
	}

	ngOnInit() {
		this.subject$
			.pipe(
				debounceTime(300),
				tap(() => this._getEmployeeProfile()),
				untilDestroyed(this)
			)
			.subscribe();
		this.route.params
			.pipe(
				filter((params) => !!params),
				tap((params) => (this.routeParams = params)),
				tap(() => this.loadTabs()),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.employeeStore.userForm$
			.pipe(
				tap((value: IUserUpdateInput) => {
					this.submitUserForm(value);
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this.employeeStore.employeeForm$
			.pipe(
				tap((value: IEmployeeUpdateInput) => {
					this.submitEmployeeForm(value);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this._applyTranslationOnTabs();
	}

	getRoute(tab: string): string {
		return `/pages/employees/edit/${this.routeParams.id}/${tab}`;
	}

	loadTabs() {
		this.tabs = [
			{
				title: this.getTranslation('EMPLOYEES_PAGE.EDIT_EMPLOYEE.ACCOUNT'),
				icon: 'person-outline',
				responsive: true,
				route: this.getRoute('account')
			},
			{
				title: this.getTranslation('EMPLOYEES_PAGE.EDIT_EMPLOYEE.NETWORKS'),
				icon: 'at-outline',
				responsive: true,
				route: this.getRoute('networks')
			},
			{
				title: this.getTranslation('EMPLOYEES_PAGE.EDIT_EMPLOYEE.EMPLOYMENT'),
				icon: 'browser-outline',
				responsive: true,
				route: this.getRoute('employment')
			},
			{
				title: this.getTranslation('EMPLOYEES_PAGE.EDIT_EMPLOYEE.HIRING'),
				icon: 'map-outline',
				responsive: true,
				route: this.getRoute('hiring')
			},
			{
				title: this.getTranslation('EMPLOYEES_PAGE.EDIT_EMPLOYEE.LOCATION'),
				icon: 'pin-outline',
				responsive: true,
				route: this.getRoute('location')
			},
			{
				title: this.getTranslation('EMPLOYEES_PAGE.EDIT_EMPLOYEE.RATES'),
				icon: 'pricetags-outline',
				responsive: true,
				route: this.getRoute('rates')
			},
			...(this.store.hasAnyPermission(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_PROJECT_VIEW)
				? [
						{
							title: this.getTranslation('EMPLOYEES_PAGE.EDIT_EMPLOYEE.PROJECTS'),
							icon: 'book-outline',
							responsive: true,
							route: this.getRoute('projects')
						}
				  ]
				: []),
			{
				title: this.getTranslation('EMPLOYEES_PAGE.EDIT_EMPLOYEE.CONTACTS'),
				icon: 'book-open-outline',
				responsive: true,
				route: this.getRoute('contacts')
			},
			{
				title: this.getTranslation('EMPLOYEES_PAGE.EDIT_EMPLOYEE.SETTINGS'),
				icon: 'settings-outline',
				responsive: true,
				route: this.getRoute('settings')
			}
		];
	}

	private async submitEmployeeForm(value: IEmployeeUpdateInput) {
		if (value) {
			try {
				/**
				 * (ORG_EMPLOYEES_EDIT) permission can update employee whole profile only.
				 * But employee can not update whole profile except some of the fields provided by UI
				 * We will define later, which fields allow to employee to update from the form
				 */
				if (!!this.store.hasPermission(PermissionsEnum.ORG_EMPLOYEES_EDIT)) {
					await this.employeeService.update(this.selectedEmployee.id, value);
				} else {
					await this.employeeService.updateProfile(this.selectedEmployee.id, value);
				}
				this.toastrService.success('TOASTR.MESSAGE.EMPLOYEE_PROFILE_UPDATE', {
					name: this.employeeName
				});
			} catch (error) {
				this.errorHandler.handleError(error);
			} finally {
				this.subject$.next(true);
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
				await this.userService.update(this.selectedEmployee.user.id, value);
				this.updatedImage.emit(value.imageUrl);
				if (!value.email) {
					this.toastrService.success('TOASTR.MESSAGE.IMAGE_UPDATED');
				} else {
					this.toastrService.success('TOASTR.MESSAGE.EMPLOYEE_PROFILE_UPDATE', { name: this.employeeName });
				}
			} catch (error) {
				this.errorHandler.handleError(error);
			} finally {
				this.subject$.next(true);
			}
		}
	}

	private async _getEmployeeProfile() {
		const { id } = this.routeParams;
		const employee = await firstValueFrom(
			this.employeeService.getEmployeeById(id, [
				'user',
				'organizationDepartments',
				'organizationPosition',
				'organizationEmploymentTypes',
				'tags',
				'skills',
				'contact'
			])
		);
		this.employeeStore.selectedEmployee = this.selectedEmployee = employee;
		this.employeeName = employee?.user?.name || employee?.user?.username || 'Employee';
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
