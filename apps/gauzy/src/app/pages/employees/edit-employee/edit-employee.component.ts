import { AfterViewInit, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
	IEmployee,
	ISelectedEmployee,
	IUser
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { filter, tap } from 'rxjs/operators';
import { EmployeesService, Store } from '../../../@core/services';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { ALL_EMPLOYEES_SELECTED } from '../../../@theme/components/header/selectors/employee';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-edit-employee',
	templateUrl: './edit-employee.component.html',
	styleUrls: [
		'./edit-employee.component.scss',
		'../../dashboard/dashboard.component.scss'
	]
})
export class EditEmployeeComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy, AfterViewInit {

	selectedEmployee: IEmployee;
	selectedDate: Date;
	selectedEmployeeFromHeader: ISelectedEmployee;

	constructor(
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly employeeService: EmployeesService,
		private readonly store: Store,
		readonly translateService: TranslateService,
		private readonly cdr: ChangeDetectorRef
	) {
		super(translateService);
	}

	ngOnInit() {
		this.store.selectedDate$
			.pipe(
				filter((date) => !!date),
				tap((date) => this.selectedDate = date),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedEmployee$
			.pipe(
				filter((employee: ISelectedEmployee) => !!employee && !!employee.id),
				tap((employee) => this.selectedEmployeeFromHeader = employee),
				untilDestroyed(this)
			)
			.subscribe(({ id }) => {
				this.cdr.detectChanges();
				this.router.navigate(['/pages/employees/edit/', id]);
			});
	}

	ngAfterViewInit() {
		this.route.params
			.pipe(
				filter((params) => !!params.id)
			)
			.subscribe(async ({ id }) => {
				try {
					const employee = await this.employeeService.getEmployeeById(id, [
						'user',
						'organizationPosition',
						'tags',
						'skills'
					]);
					this.selectedEmployee = employee;
					if (employee.startedWorkOn) {
						setTimeout(() => {
							this.store.selectedEmployee = {
								id: employee.id,
								firstName: employee.user.firstName,
								lastName: employee.user.lastName,
								fullName: employee.user.name,
								imageUrl: employee.user.imageUrl,
								tags: employee.user.tags || [],
								skills: employee.skills || []
							};
						}, 1600);
					}	
				} catch (error) {
					this.router.navigate(['/pages/employees']);
				}
			});
	}

	ngOnDestroy() {
		this.store.user$
			.pipe(
				filter((user) => !!user),
				tap((user: IUser) => {
					if (!!user && !user.employeeId) {
						this.store.selectedEmployee = ALL_EMPLOYEES_SELECTED;
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}
}
