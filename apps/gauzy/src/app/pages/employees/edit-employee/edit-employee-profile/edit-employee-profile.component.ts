import { Component, OnDestroy, OnInit, Output, EventEmitter } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { debounceTime, filter, firstValueFrom, Subject, tap } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ID, IEmployee, IEmployeeUpdateInput, IUserUpdateInput, PermissionsEnum } from '@gauzy/contracts';
import {
	EmployeesService,
	EmployeeStore,
	ErrorHandlingService,
	PageTabRegistryConfig,
	PageTabRegistryService,
	PageTabsetRegistryId,
	Store,
	ToastrService,
	UsersService
} from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ngx-edit-employee-profile',
    templateUrl: './edit-employee-profile.component.html',
    styleUrls: ['./edit-employee-profile.component.scss'],
    providers: [EmployeeStore],
    standalone: false
})
export class EditEmployeeProfileComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public tabsetId: PageTabsetRegistryId = this._route.snapshot.data.tabsetId; // The identifier for the tabset
	public employeeId: ID = this._route.snapshot.params.id;

	selectedEmployee: IEmployee;
	employeeName: string;
	subject$: Subject<any> = new Subject();

	@Output() updatedImage = new EventEmitter<any>();

	constructor(
		public readonly translateService: TranslateService,
		private readonly _route: ActivatedRoute,
		private readonly _employeeService: EmployeesService,
		private readonly _userService: UsersService,
		private readonly _toastrService: ToastrService,
		private readonly _employeeStore: EmployeeStore,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly _store: Store,
		private readonly _pageTabRegistryService: PageTabRegistryService
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
		this._route.params
			.pipe(
				filter((params) => !!params),
				tap(() => this._registerPageTabs()),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this._employeeStore.userForm$
			.pipe(
				tap((value: IUserUpdateInput) => {
					this.submitUserForm(value);
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this._employeeStore.employeeForm$
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

	/**
	 * Constructs a route URL for a specific tab in the 'edit-employee' view.
	 *
	 * This method dynamically generates the route URL based on the employee's ID
	 * and the tab passed as a parameter. It is used to navigate between
	 * different sections (tabs) of the employee edit page.
	 *
	 * @param {string} tab - The name of the tab for which to generate the route.
	 * @returns {string} - The complete route URL for the specified tab.
	 */
	getRoute(tab: string): string {
		return `/pages/employees/edit/${this.employeeId}/${tab}`;
	}

	/**
	 * Registers custom tabs for the 'employee-edit' page.
	 * This method defines and registers the various tabs, their icons, routes, and titles.
	 */
	private _registerPageTabs(): void {
		const tabs: PageTabRegistryConfig[] = this._createTabsConfig();

		// Register each tab using the page tab registry service
		tabs.forEach((tab: PageTabRegistryConfig) => this._pageTabRegistryService.registerPageTab(tab));
	}

	/**
	 * Creates the configuration for the tabs used in the 'employee-edit' page.
	 * @returns An array of PageTabRegistryConfig objects.
	 */
	private _createTabsConfig(): PageTabRegistryConfig[] {
		return [
			{
				tabsetId: this.tabsetId,
				tabId: 'account',
				tabIcon: 'person-outline',
				tabsetType: 'route',
				tabTitle: (_i18n) => _i18n.getTranslation('EMPLOYEES_PAGE.EDIT_EMPLOYEE.ACCOUNT'),
				order: 0,
				responsive: true,
				route: this.getRoute('account')
			},
			{
				tabsetId: this.tabsetId,
				tabId: 'networks',
				tabIcon: 'at-outline',
				tabsetType: 'route',
				tabTitle: (_i18n) => _i18n.getTranslation('EMPLOYEES_PAGE.EDIT_EMPLOYEE.NETWORKS'),
				order: 1,
				responsive: true,
				route: this.getRoute('networks')
			},
			{
				tabsetId: this.tabsetId,
				tabId: 'employment',
				tabIcon: 'browser-outline',
				tabsetType: 'route',
				tabTitle: (_i18n) => _i18n.getTranslation('EMPLOYEES_PAGE.EDIT_EMPLOYEE.EMPLOYMENT'),
				order: 2,
				responsive: true,
				route: this.getRoute('employment')
			},
			{
				tabsetId: this.tabsetId,
				tabId: 'hiring',
				tabIcon: 'browser-outline',
				tabsetType: 'route',
				tabTitle: (_i18n) => _i18n.getTranslation('EMPLOYEES_PAGE.EDIT_EMPLOYEE.HIRING'),
				order: 3,
				responsive: true,
				route: this.getRoute('hiring')
			},
			{
				tabsetId: this.tabsetId,
				tabId: 'location',
				tabIcon: 'pin-outline',
				tabsetType: 'route',
				tabTitle: (_i18n) => _i18n.getTranslation('EMPLOYEES_PAGE.EDIT_EMPLOYEE.LOCATION'),
				order: 4,
				responsive: true,
				route: this.getRoute('location')
			},
			{
				tabsetId: this.tabsetId,
				tabId: 'rates',
				tabIcon: 'pricetags-outline',
				tabsetType: 'route',
				tabTitle: (_i18n) => _i18n.getTranslation('EMPLOYEES_PAGE.EDIT_EMPLOYEE.RATES'),
				order: 5,
				responsive: true,
				route: this.getRoute('rates')
			},
			{
				tabsetId: this.tabsetId,
				tabId: 'projects',
				tabIcon: 'book-open-outline',
				tabsetType: 'route',
				tabTitle: (_i18n) => _i18n.getTranslation('EMPLOYEES_PAGE.EDIT_EMPLOYEE.PROJECTS'),
				order: 6,
				responsive: true,
				route: this.getRoute('projects'),
				permissions: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_PROJECT_VIEW]
			},
			{
				tabsetId: this.tabsetId,
				tabId: 'contacts',
				tabIcon: 'book-outline',
				tabsetType: 'route',
				tabTitle: (_i18n) => _i18n.getTranslation('EMPLOYEES_PAGE.EDIT_EMPLOYEE.CONTACTS'),
				order: 7,
				responsive: true,
				route: this.getRoute('contacts')
			},
			{
				tabsetId: this.tabsetId,
				tabId: 'settings',
				tabIcon: 'settings-outline',
				tabsetType: 'route',
				tabTitle: (_i18n) => _i18n.getTranslation('EMPLOYEES_PAGE.EDIT_EMPLOYEE.SETTINGS'),
				order: 8,
				responsive: true,
				route: this.getRoute('settings')
			}
		];
	}

	/**
	 * Retrieves and sets the profile of the selected employee
	 *
	 * @returns
	 */
	private async _getEmployeeProfile() {
		try {
			if (!this.employeeId) {
				return;
			}

			// Fetch employee data from the service
			const employee = await firstValueFrom(
				this._employeeService.getEmployeeById(this.employeeId, [
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
			this._employeeStore.selectedEmployee = this.selectedEmployee = employee;

			// Set the employee name for display
			this.employeeName = employee?.user?.name || employee?.user?.username || 'Unknown Employee';
		} catch (error) {
			// Handle errors gracefully
			console.error('Error fetching employee profile:', error);
			this._errorHandlingService.handleError(error);
		}
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
				if (this._store.hasPermission(PermissionsEnum.ORG_EMPLOYEES_EDIT)) {
					await this._employeeService.update(this.selectedEmployee.id, value);
				} else {
					// Update only allowed fields if user does not have full edit permission
					await this._employeeService.updateProfile(this.selectedEmployee.id, value);
				}

				// Show success message on successful update
				this._toastrService.success('TOASTR.MESSAGE.EMPLOYEE_PROFILE_UPDATE', { name: this.employeeName });
			} catch (error) {
				// Handle and log errors
				console.log('Error while updating employee profile:', error);
				this._errorHandlingService.handleError(error);
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
				await this._userService.update(this.selectedEmployee.user.id, user);

				if (!!user.image) {
					// Emit event for updated image (assuming this emits an event when the image is updated)
					this.updatedImage.emit(user.image);
				}

				// Show success message based on whether email was updated or not
				if (!user.email) {
					this._toastrService.success('TOASTR.MESSAGE.IMAGE_UPDATED');
				} else {
					this._toastrService.success('TOASTR.MESSAGE.EMPLOYEE_PROFILE_UPDATE', { name: this.employeeName });
				}
			} catch (error) {
				// Handle and log errors
				console.log('Error while updating user profile:', error);
				this._errorHandlingService.handleError(error);
			} finally {
				// Notify subscribers that form submission is complete
				this.subject$.next(true);
			}
		}
	}

	/**
	 * Applies translations to the page tabs.
	 */
	private _applyTranslationOnTabs() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._registerPageTabs()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy() {}
}
