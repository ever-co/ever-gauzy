import { Component, OnInit, OnDestroy } from '@angular/core';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Observable, Subject, of } from 'rxjs';
import { map, tap, takeUntil } from 'rxjs/operators';
import { PermissionsEnum, IEmployee, IEmployeeAward } from '@gauzy/models';
import { Store } from '../../@core/services/store.service';
import * as moment from 'moment';
import { NbDialogService } from '@nebular/theme';
import { PublicPageEmployeeMutationComponent } from '../../@shared/employee/public-page-employee-mutation/public-page-employee-mutation.component';
import { EmployeesService, UsersService } from '../../@core/services';
import { ToastrService } from '../../@core/services/toastr.service';
import { ErrorHandlingService } from '../../@core/services/error-handling.service';
import { EmployeeAwardService } from '../../@core/services/employee-award.service';

@Component({
	selector: 'ngx-employee',
	templateUrl: './employee.component.html',
	styleUrls: ['./employee.component.scss']
})
export class EmployeeComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$: Subject<void> = new Subject();
	hasEditPermission$: Observable<boolean>;
	imageUrl: string;
	imageUpdateButton: boolean;
	employee$: Observable<IEmployee>;
	hoverState: boolean;
	employeeAwards: IEmployeeAward[];

	constructor(
		private employeeService: EmployeesService,
		private userService: UsersService,
		private activatedRoute: ActivatedRoute,
		readonly translateService: TranslateService,
		private dialogService: NbDialogService,
		private toastrService: ToastrService,
		private store: Store,
		private errorHandlingService: ErrorHandlingService,
		private employeeAwardService: EmployeeAwardService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.initEmployeePublicData();
		this.initEmployeeAwards();
		this.handleUserPermission();
	}

	private initEmployeePublicData() {
		this.employee$ = this.activatedRoute.data.pipe(
			map(({ employee }) => ({
				...employee,
				startedWorkOn: employee.startedWorkOn
					? moment(employee.startedWorkOn).format('MM-DD-YYYY')
					: undefined
			})),
			tap((employee) => (this.imageUrl = employee.user.imageUrl))
		);
	}

	private initEmployeeAwards() {
		const employeeId = this.activatedRoute.snapshot.params.employeeId;
		this.employeeAwardService
			.getAll({ employeeId })
			.pipe(
				tap(({ items }) => (this.employeeAwards = items)),
				takeUntil(this._ngDestroy$)
			)
			.subscribe();
	}

	private handleUserPermission() {
		this.hasEditPermission$ = this.store.userRolePermissions$.pipe(
			map(() =>
				this.store.hasPermission(PermissionsEnum.PUBLIC_PAGE_EDIT)
			)
		);
	}

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

	openEditEmployeeDialog(employee) {
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
				takeUntil(this._ngDestroy$)
			)
			.subscribe();
	}

	async handleEmployeeUpdate(
		employee,
		{
			username,
			email,
			firstName,
			lastName,
			preferredLanguage,
			...empFormValue
		}
	) {
		try {
			const updatedUser: any = await this.userService.update(
				employee.user.id,
				{
					username,
					email,
					firstName,
					lastName,
					preferredLanguage
				}
			);
			const employeeUpdatedRes = await this.employeeService.update(
				employee.id,
				empFormValue
			);

			const updatedFemployee = {
				...employee,
				...employeeUpdatedRes,
				isActive: employee.isActive,
				billRateCurrency: employee.billRateCurrency,
				user: {
					...employee.user,
					...updatedUser,
					imageUrl: updatedUser.imageUrl
						? updatedUser.imageUrl
						: employee.user.imageUrl
				},
				startedWorkOn: employeeUpdatedRes.startedWorkOn
					? moment(new Date(employeeUpdatedRes.startedWorkOn)).format(
							'MM-DD-YYYY'
					  )
					: employee.startedWorkOn
			};
			this.employee$ = of(updatedFemployee);
			this.toastrService.success('PUBLIC_PAGE.EMPLOYEE_UPDATED');
		} catch (e) {
			this.errorHandlingService.handleError(e);
		}
	}

	handleImageUploadError(error: any) {
		this.toastrService.danger(error, 'Error');
	}

	ngOnDestroy(): void {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
