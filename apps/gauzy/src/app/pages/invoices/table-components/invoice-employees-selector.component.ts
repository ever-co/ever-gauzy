import { Component, OnInit, OnDestroy } from '@angular/core';
import { IEmployee } from '@gauzy/contracts';
import { EmployeesService } from '../../../@core/services';
import { DefaultEditor } from 'ng2-smart-table';
import { Store } from '../../../@core/services/store.service';
import { filter } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
@UntilDestroy({ checkProperties: true })
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
export class InvoiceEmployeesSelectorComponent
	extends DefaultEditor
	implements OnInit, OnDestroy {
	employee: IEmployee;
	employees: IEmployee[];

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
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe(async (organization) => {
				if (organization) {
					const tenantId = this.store.user.tenantId;
					const { id: organizationId } = organization;
					this.employeeService
						.getAll(['user'], { organizationId, tenantId })
						.pipe(untilDestroyed(this))
						.subscribe((employees) => {
							const filteredEmployees = employees.items;
							this.employees = filteredEmployees;
							if (this.employees.length) {
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

	ngOnDestroy() {}
}
