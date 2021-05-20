import { AfterViewInit, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
	IEmployee,
	ISelectedEmployee
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { filter, tap } from 'rxjs/operators';
import { EmployeesService, Store } from '../../../@core/services';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';

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
	employeeName = 'Employee';

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
				tap((date) => this.selectedDate = date),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedEmployee$
			.pipe(
				filter((employee: ISelectedEmployee) => !!employee && !!employee.id),
				untilDestroyed(this)
			)
			.subscribe((employee) => {
				this.selectedEmployeeFromHeader = employee;
				this.cdr.detectChanges();		
				if (employee.id) {
					this.router.navigate([
						'/pages/employees/edit/' + employee.id
					]);
				}
			});
	}

	ngAfterViewInit() {
		this.route.params
			.pipe(
				filter((params) => !!params.id)
			)
			.subscribe(async ({ id }) => {
				const employee = await this.employeeService.getEmployeeById(id, ['user', 'organizationPosition', 'tags', 'skills']);
				const checkUsername = employee.user.username;
				this.employeeName = checkUsername ? checkUsername : 'Employee';
				this.selectedEmployee = employee;
				this.store.selectedEmployee = {
					id: employee.id,
					firstName: employee.user.firstName,
					lastName: employee.user.lastName,
					fullName: employee.user.name,
					imageUrl: employee.user.imageUrl,
					tags: employee.user.tags,
					skills: employee.skills
				};
			});
	}

	ngOnDestroy() {}
}
