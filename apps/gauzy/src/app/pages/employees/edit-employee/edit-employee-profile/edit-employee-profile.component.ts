import { Component, OnDestroy, OnInit, Output, EventEmitter } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom, Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { NbRouteTab } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IEmployee, IEmployeeUpdateInput, IUserUpdateInput, PermissionsEnum } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { Store } from '@gauzy/ui-core/common';
import {
	EmployeesService,
	EmployeeStore,
	ErrorHandlingService,
	ToastrService,
	UsersService
} from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-edit-employee-profile',
	templateUrl: './edit-employee-profile.component.html',
	styleUrls: ['./edit-employee-profile.component.scss'],
	providers: [EmployeeStore]
})
export class EditEmployeeProfileComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	routeParams: Params;
	selectedEmployee: IEmployee;
	employeeName: string;
	tabs: NbRouteTab[] = [];
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

	/**
	 * Submit the employee form with updated data
	 *
	 * @param value - The updated employee form data to submit.
	 */
	private async submitEmployeeForm(value: IEmployeeUpdateInput) {
		if (value) {
			try {
				/**
				 * (ORG_EMPLOYEES_EDIT) permission can update employee whole profile only.
				 * But employee can not update whole profile except some of the fields provided by UI
				 * We will define later, which fields allow to employee to update from the form
				 */
				if (this.store.hasPermission(PermissionsEnum.ORG_EMPLOYEES_EDIT)) {
					await this.employeeService.update(this.selectedEmployee.id, value);
				} else {
					// Update only allowed fields if user does not have full edit permission
					await this.employeeService.updateProfile(this.selectedEmployee.id, value);
				}

				// Show success message on successful update
				this.toastrService.success('TOASTR.MESSAGE.EMPLOYEE_PROFILE_UPDATE', { name: this.employeeName });
			} catch (error) {
				// Handle and log errors
				this.errorHandler.handleError(error);
			} finally {
				// Notify subscribers that form submission is complete
				this.subject$.next(true);
			}
		}
	}

	/**
	 * Submit the user form with updated data
	 *
	 * @param user - The updated user data to submit.
	 */
	private async submitUserForm(user: IUserUpdateInput) {
		if (user) {
			try {
				// Update the user using userService
				await this.userService.update(this.selectedEmployee.user.id, user);

				if (!!user.image) {
					// Emit event for updated image (assuming this emits an event when the image is updated)
					this.updatedImage.emit(user.image);
				}

				// Show success message based on whether email was updated or not
				if (!user.email) {
					this.toastrService.success('TOASTR.MESSAGE.IMAGE_UPDATED');
				} else {
					this.toastrService.success('TOASTR.MESSAGE.EMPLOYEE_PROFILE_UPDATE', { name: this.employeeName });
				}
			} catch (error) {
				// Handle and log errors
				this.errorHandler.handleError(error);
			} finally {
				// Notify subscribers that form submission is complete
				this.subject$.next(true);
			}
		}
	}

	/**
	 * Retrieves and sets the profile of the selected employee
	 */
	private async _getEmployeeProfile() {
		try {
			const { id } = this.routeParams;
			if (!id) {
				return;
			}

			// Fetch employee data from the service
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

			// Set the selected employee in the store and component
			this.employeeStore.selectedEmployee = this.selectedEmployee = employee;

			// Set the employee name for display
			this.employeeName = employee?.user?.name || employee?.user?.username || 'Unknown Employee';
		} catch (error) {
			// Handle errors gracefully
			console.error('Error fetching employee profile:', error);
			// Optionally, navigate to a fallback route or show an error message
		}
	}

	private _applyTranslationOnTabs() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this.loadTabs()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy() {}
}
