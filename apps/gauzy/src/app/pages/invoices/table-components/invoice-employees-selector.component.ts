import { Component, OnInit, OnDestroy } from '@angular/core';
import { IEmployee, IOrganization } from '@gauzy/contracts';
import { DefaultEditor } from 'ng2-smart-table';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { isNotEmpty } from '@gauzy/common-angular';
import { EmployeesService, Store } from '../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	template: `
		<nb-select
			fullWidth
			[placeholder]="'INVOICES_PAGE.SELECT_EMPLOYEE' | translate"
			[(ngModel)]="employee"
			(selectedChange)="selectEmployee($event)"
		>
			<nb-option *ngFor="let employee of employees" [value]="employee">
				<img
					[src]="employee.user.imageUrl"
					alt="Smiley face"
					height="40"
					width="40"
					style="margin-right:10px"
				/>
				{{ employee.fullName }}
			</nb-option>
		</nb-select>
	`,
	styles: []
})
export class InvoiceEmployeesSelectorComponent
	extends DefaultEditor
	implements OnInit, OnDestroy {

	employee: IEmployee;
	employees: IEmployee[] = [];
	organization: IOrganization;

	constructor(
		private readonly employeeService: EmployeesService,
		private readonly store: Store
	) {
		super();
	}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				tap((organization) => (this.organization = organization)),
				tap(() => this._getWorkingEmployees()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Get working employees of the selected month
	 */
	 private async _getWorkingEmployees(): Promise<void> {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const { selectedDate } = this.store;

		const { items = [] } = await this.employeeService.getWorking(
			organizationId,
			tenantId,
			selectedDate,
			true
		);
		this.employees = items;
		this.preSelectedEmployee();
	}

	preSelectedEmployee() {
		const { newValue } = this.cell;
		if (isNotEmpty(this.employees)) {
			this.employee = this.employees.find(
				(employee: IEmployee) => employee.id === newValue.id
			);
		}
	}

	selectEmployee($event) {
		this.cell.newValue = $event;
	}

	ngOnDestroy() {}
}
