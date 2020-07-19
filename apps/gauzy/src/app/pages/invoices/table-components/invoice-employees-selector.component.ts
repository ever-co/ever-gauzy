import { Component, OnInit, OnDestroy } from '@angular/core';
import { Employee } from '@gauzy/models';
import { EmployeesService } from '../../../@core/services';
import { DefaultEditor } from 'ng2-smart-table';
import { Store } from '../../../@core/services/store.service';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

@Component({
	template: `
		<nb-select
			fullWidth
			placeholder="{{ 'INVOICES_PAGE.SELECT_EMPLOYEE' | translate }}"
			[(ngModel)]="employee"
			(selectedChange)="selectEmployee($event)"
		>
			<nb-option *ngFor="let employee of employees" [value]="employee">
				<img
					src="{{ employee.user.imageUrl }}"
					alt="Smiley face"
					height="40"
					width="40"
					style="margin-right:10px"
				/>
				{{ employee.user.firstName }}
				{{ employee.user.lastName }}
			</nb-option>
		</nb-select>
	`,
	styles: []
})
export class InvoiceEmployeesSelectorComponent extends DefaultEditor
	implements OnInit, OnDestroy {
	employee: Employee;
	employees: Employee[];
	private _ngDestroy$ = new Subject<void>();

	constructor(
		readonly employeeService: EmployeesService,
		private store: Store
	) {
		super();
	}

	ngOnInit() {
		this.getEmployees();
	}

	async getEmployees() {
		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (organization) => {
				if (organization) {
					this.employeeService
						.getAll(['user'])
						.pipe(takeUntil(this._ngDestroy$))
						.subscribe((employees) => {
							const filteredEmployees = employees.items.filter(
								(emp) => {
									return (
										emp.orgId === organization.id ||
										organization.id === ''
									);
								}
							);
							this.employees = filteredEmployees;
							if (this.employees) {
								const employee = this.employees.find(
									(e) => e.id === this.cell.newValue
								);
								this.employee = employee;
							}
						});
				}
			});
	}

	selectEmployee($event) {
		this.cell.newValue = $event.id;
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
