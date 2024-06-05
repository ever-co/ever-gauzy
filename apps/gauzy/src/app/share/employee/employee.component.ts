import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { NbDialogService } from '@nebular/theme';
import { PermissionsEnum, IEmployee, IEmployeeAward, IOrganization } from '@gauzy/contracts';
import moment from 'moment';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/shared';
import { Store } from '@gauzy/ui-sdk/common';
import { EmployeesService, ErrorHandlingService, ToastrService, UsersService } from '@gauzy/ui-sdk/core';
import { PublicPageEmployeeMutationComponent } from '../../@shared/employee/public-page-employee-mutation/public-page-employee-mutation.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-employee-share',
	templateUrl: './employee.component.html',
	styleUrls: ['./employee.component.scss']
})
export class EmployeeComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	hasEditPermission$: Observable<boolean>;
	imageUrl: string;
	imageUpdateButton: boolean;
	public organization$: Observable<IOrganization>;
	public organization: IOrganization;
	public employee$: Observable<IEmployee>;
	hoverState: boolean;
	employeeAwards: IEmployeeAward[] = [];

	constructor(
		private readonly employeeService: EmployeesService,
		private readonly userService: UsersService,
		private readonly route: ActivatedRoute,
		readonly translateService: TranslateService,
		private readonly dialogService: NbDialogService,
		private readonly toastrService: ToastrService,
		private readonly store: Store,
		private readonly errorHandlingService: ErrorHandlingService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.organization$ = this.route.data.pipe(
			map(({ organization }) => organization),
			tap((organization: IOrganization) => (this.organization = organization))
		);
		this.employee$ = this.route.data.pipe(
			map(({ employee }) => ({
				...employee,
				startedWorkOn: employee.startedWorkOn ? moment(employee.startedWorkOn).toDate() : undefined
			})),
			tap((employee: IEmployee) => (this.imageUrl = employee.user.imageUrl)),
			tap((employee: IEmployee) => (this.employeeAwards = employee.awards))
		);
		this.hasEditPermission$ = this.store.userRolePermissions$.pipe(
			map(() => this.store.hasPermission(PermissionsEnum.PUBLIC_PAGE_EDIT))
		);
	}

	ngAfterViewInit() {}

	updateImageUrl(url: string) {
		this.imageUrl = url;
		this.imageUpdateButton = true;
	}

	async saveImage({ userId, imageUrl }) {
		try {
			await this.userService.update(userId, {
				imageUrl
			});
			this.toastrService.success('PUBLIC_PAGE.IMAGE_UPDATED');
		} catch (e) {
			this.errorHandlingService.handleError(e);
		}

		this.imageUpdateButton = false;
	}

	openEditEmployeeDialog(employee: IEmployee) {
		if (!this.store.hasPermission(PermissionsEnum.PUBLIC_PAGE_EDIT)) {
			return;
		}
		this.dialogService
			.open(PublicPageEmployeeMutationComponent, {
				context: {
					employee,
					employeeAwards: this.employeeAwards
				}
			})
			.onClose.pipe(
				tap(async (empFormValue) => {
					if (empFormValue) {
						await this.handleEmployeeUpdate(employee, empFormValue);
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	async handleEmployeeUpdate(employee, { username, email, firstName, lastName, preferredLanguage, ...empFormValue }) {
		try {
			if (!this.organization) {
				return;
			}
			const { id: organizationId, tenantId } = this.organization;
			const updatedUser: any = await this.userService.update(employee.user.id, {
				username,
				email,
				firstName,
				lastName,
				preferredLanguage
			});
			const employeeUpdatedRes = await this.employeeService.update(employee.id, {
				organizationId,
				tenantId,
				...empFormValue
			});
			const updatedEmployee = {
				...employee,
				...employeeUpdatedRes,
				isActive: employee.isActive,
				billRateCurrency: employee.billRateCurrency,
				user: {
					...employee.user,
					...updatedUser,
					imageUrl: updatedUser.imageUrl ? updatedUser.imageUrl : employee.user.imageUrl
				},
				startedWorkOn: employeeUpdatedRes.startedWorkOn
					? moment(new Date(employeeUpdatedRes.startedWorkOn)).format('MM-DD-YYYY')
					: employee.startedWorkOn
			};
			this.employee$ = of(updatedEmployee);
			this.toastrService.success('PUBLIC_PAGE.EMPLOYEE_UPDATED');
		} catch (e) {
			this.errorHandlingService.handleError(e);
		}
	}

	handleImageUploadError(error: any) {
		this.toastrService.danger(error, 'Error');
	}

	ngOnDestroy(): void {}
}
