import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
	IEmployee,
	IEmployeeRecurringExpense,
	IOrganization,
	PermissionsEnum
} from '@gauzy/models';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { first, takeUntil } from 'rxjs/operators';
import { EmployeesService } from '../../../@core/services/employees.service';
import { Store } from '../../../@core/services/store.service';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { SelectedEmployee } from '../../../@theme/components/header/selectors/employee/employee.component';

@Component({
	selector: 'ngx-edit-employee',
	templateUrl: './edit-employee.component.html',
	styleUrls: [
		'./edit-employee.component.scss',
		'../../dashboard/dashboard.component.scss'
	]
})
export class EditEmployeeComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	selectedEmployee: IEmployee;
	selectedDate: Date;
	selectedEmployeeFromHeader: SelectedEmployee;
	selectedEmployeeRecurringExpense: IEmployeeRecurringExpense[];
	selectedRowIndexToShow: number;
	employeeName = 'Employee';
	hasEditPermission = false;
	fetchedHistories: Object = {};
	selectedOrganization: IOrganization;

	constructor(
		private route: ActivatedRoute,
		private router: Router,
		private employeeService: EmployeesService,
		private store: Store,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	async ngOnInit() {
		this.store.selectedDate$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((date) => {
				this.selectedDate = date;
			});

		this.store.userRolePermissions$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.hasEditPermission = this.store.hasPermission(
					PermissionsEnum.ORG_EMPLOYEES_EDIT
				);
			});

		this.route.params
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (params) => {
				const id = params.id;

				const { items } = await this.employeeService
					.getAll(
						['user', 'organizationPosition', 'tags', 'skills'],
						{ id }
					)
					.pipe(first())
					.toPromise();

				this.selectedEmployee = items[0];

				this.store.selectedEmployee = {
					id: items[0].id,
					firstName: items[0].user.firstName,
					lastName: items[0].user.lastName,
					imageUrl: items[0].user.imageUrl,
					tags: items[0].user.tags,
					skills: items[0].skills
				};

				const checkUsername = this.selectedEmployee.user.username;
				this.employeeName = checkUsername ? checkUsername : 'Employee';

				this.store.selectedEmployee$
					.pipe(takeUntil(this._ngDestroy$))
					.subscribe((employee) => {
						this.selectedEmployeeFromHeader = employee;
						if (employee.id) {
							this.router.navigate([
								'/pages/employees/edit/' + employee.id
							]);
						}
					});

				this.store.selectedOrganization$
					.pipe(takeUntil(this._ngDestroy$))
					.subscribe((organization) => {
						this.selectedOrganization = organization;
					});
			});
	}
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
