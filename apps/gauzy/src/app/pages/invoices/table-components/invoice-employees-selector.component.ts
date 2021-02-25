import { Component, OnInit, OnDestroy } from '@angular/core';
import { IEmployee, IOrganization } from '@gauzy/contracts';
import { EmployeesService } from '../../../@core/services';
import { DefaultEditor } from 'ng2-smart-table';
import { Store } from '../../../@core/services/store.service';
import { filter, tap } from 'rxjs/operators';
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
	organization: IOrganization;

	constructor(
		readonly employeeService: EmployeesService,
		private store: Store
	) {
		super();
	}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				tap((organization) => (this.organization = organization)),
				tap(() => this._loadEmployees()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _loadEmployees() {
		const tenantId = this.store.user.tenantId;
		const { id: organizationId } = this.organization;
		this.employeeService
			.getAll(['user'], { organizationId, tenantId })
			.pipe(untilDestroyed(this))
			.subscribe(({ items }) => {
				this.employees = items;
				if (this.employees.length) {
					this.employee = this.employees.find(
						(e) => e.id === this.cell.newValue.id
					);
				}
			});
	}

	selectEmployee($event) {
		this.cell.newValue = $event;
	}

	ngOnDestroy() {}
}
