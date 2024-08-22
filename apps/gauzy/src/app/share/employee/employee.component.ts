import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Data } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { NbDialogService } from '@nebular/theme';
import { PermissionsEnum, IEmployee, IEmployeeAward, IOrganization, IUser } from '@gauzy/contracts';
import * as moment from 'moment';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { EmployeesService, ErrorHandlingService, Store, ToastrService, UsersService } from '@gauzy/ui-core/core';
import { PublicPageEmployeeMutationComponent } from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-employee-share',
	templateUrl: './employee.component.html',
	styleUrls: ['./employee.component.scss']
})
export class EmployeeComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public hasEditPermission$: Observable<boolean>;
	public imageUrl: string;
	public imageUpdateButton: boolean;
	public organization$: Observable<IOrganization>;
	public organization: IOrganization;
	public employee$: Observable<IEmployee>;
	public hoverState: boolean;
	public employeeAwards: IEmployeeAward[] = [];

	constructor(
		readonly translateService: TranslateService,
		private readonly _employeeService: EmployeesService,
		private readonly _userService: UsersService,
		private readonly _route: ActivatedRoute,
		private readonly _dialogService: NbDialogService,
		private readonly _toastrService: ToastrService,
		private readonly _store: Store,
		private readonly _errorHandlingService: ErrorHandlingService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.organization$ = this._route.data.pipe(
			map(({ organization }: Data) => organization),
			tap((organization: IOrganization) => (this.organization = organization))
		);
		this.employee$ = this._route.data.pipe(
			map(({ employee }: Data) => ({
				...employee,
				startedWorkOn: employee.startedWorkOn ? new Date(employee.startedWorkOn) : null
			})),
			tap((employee: IEmployee) => (this.imageUrl = employee.user.imageUrl)),
			tap((employee: IEmployee) => (this.employeeAwards = employee.awards))
		);
		this.hasEditPermission$ = this._store.userRolePermissions$.pipe(
			map(() => this._store.hasPermission(PermissionsEnum.PUBLIC_PAGE_EDIT))
		);
	}

	/**
	 * Updates the image url of an employee.
	 *
	 * @param url - The image url to be updated.
	 */
	updateImageUrl(url: string) {
		this.imageUrl = url;
		this.imageUpdateButton = true;
	}

	/**
	 * Saves the image of an employee.
	 *
	 * @param param0 - The user id and image url to be saved.
	 */
	async saveImage({ userId, imageUrl }): Promise<void> {
		try {
			await this._userService.update(userId, { imageUrl });
			this._toastrService.success('PUBLIC_PAGE.IMAGE_UPDATED');
		} catch (error) {
			this._errorHandlingService.handleError(error);
		}

		this.imageUpdateButton = false;
	}

	/**
	 * Opens a dialog to edit an employee.
	 *
	 * @param {IEmployee} employee - The employee to be edited.
	 * @return {void} This function does not return a value.
	 */
	openEditEmployeeDialog(employee: IEmployee): void {
		if (!this._store.hasPermission(PermissionsEnum.PUBLIC_PAGE_EDIT)) {
			return;
		}

		// Open the dialog.
		const dialog$ = this._dialogService.open(PublicPageEmployeeMutationComponent, {
			context: {
				employee,
				employeeAwards: this.employeeAwards
			}
		});

		dialog$.onClose
			.pipe(
				tap(async (formValue) => {
					if (formValue) {
						await this.handleEmployeeUpdate(employee, formValue);
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Handles the update of an employee.
	 *
	 * @param employee
	 * @param formValue
	 * @returns
	 */
	async handleEmployeeUpdate(employee: IEmployee, formValue: any) {
		try {
			if (!this.organization) return;

			const { id: organizationId, tenantId } = this.organization;
			const { username, email, firstName, lastName, preferredLanguage, ...employeeFormValue } = formValue;

			// Update the user.
			const updatedUser: IUser = await this._userService.update(employee.user.id, {
				username,
				email,
				firstName,
				lastName,
				preferredLanguage
			});

			// Update the employee.
			const updatedEmployee: IEmployee = await this._employeeService.update(employee.id, {
				organizationId,
				tenantId,
				...employeeFormValue
			});

			// Update the employee$ observable.
			this.employee$ = of({
				...employee,
				...updatedEmployee,
				isActive: employee.isActive,
				billRateCurrency: employee.billRateCurrency,
				user: {
					...employee.user,
					...updatedUser,
					imageUrl: updatedUser.imageUrl ? updatedUser.imageUrl : employee.user.imageUrl
				},
				startedWorkOn: updatedEmployee.startedWorkOn
					? moment(updatedEmployee.startedWorkOn).toDate()
					: employee.startedWorkOn
			});

			// Display a success toastr.
			this._toastrService.success('PUBLIC_PAGE.EMPLOYEE_UPDATED');
		} catch (error) {
			console.log('Error while updating employee', error);
			this._errorHandlingService.handleError(error);
		}
	}

	/**
	 *
	 * @param error - The error to be handled.
	 * @return {void} This function does not return a value.
	 */
	handleImageUploadError(error: any): void {
		console.log('Error while uploading image', error);
		this._errorHandlingService.handleError(error);
	}

	ngOnDestroy(): void {}
}
