import { Component, OnInit, OnDestroy } from '@angular/core';
import { DefaultEditor } from 'angular2-smart-table';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IEmployee, IOrganization } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/ui-sdk/common';
import { DateRangePickerBuilderService } from '@gauzy/ui-sdk/core';
import { Store } from '@gauzy/ui-sdk/common';
import { EmployeesService } from '@gauzy/ui-sdk/core';

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
export class InvoiceEmployeesSelectorComponent extends DefaultEditor implements OnInit, OnDestroy {
	public employee: IEmployee;
	public employees: IEmployee[] = [];
	public organization: IOrganization;

	constructor(
		private readonly employeeService: EmployeesService,
		private readonly store: Store,
		private readonly dateRangePickerBuilderService: DateRangePickerBuilderService
	) {
		super();
	}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this._getWorkingEmployees()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Get working employees of the selected month
	 */
	private async _getWorkingEmployees(): Promise<void> {
		if (!this.organization) {
			return;
		}

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const { selectedDateRange } = this.dateRangePickerBuilderService;

		const { items = [] } = await this.employeeService.getWorking(organizationId, tenantId, selectedDateRange, true);
		this.employees = items;
		this.preSelectedEmployee();
	}

	/**
	 * This function is used to pre-select an employee from a list of employees.
	 * It retrieves the raw value of the cell (presumably containing employee data),
	 * and then attempts to find a matching employee from the list of employees.
	 */
	preSelectedEmployee() {
		// Get the raw value of the cell, which is assumed to be an employee object
		const employee: any = this.cell.getRawValue();

		// Check if the list of employees is not empty
		if (isNotEmpty(this.employees)) {
			// Find the employee in the list whose ID matches the ID of the employee from the cell
			this.employee = this.employees.find((item: IEmployee) => item.id === employee.id);
		}
	}

	/**
	 * This function is used to select an employee and set the value of the associated cell.
	 * @param employee The employee to be selected and set as the cell value.
	 */
	selectEmployee(employee: any) {
		// Set the value of the cell to the specified employee
		this.cell.setValue(employee);
	}

	ngOnDestroy() {}
}
