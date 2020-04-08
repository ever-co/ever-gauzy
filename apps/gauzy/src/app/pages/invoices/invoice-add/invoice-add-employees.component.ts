import { Component, OnInit } from '@angular/core';
import { EmployeesService } from '../../../@core/services/employees.service';
import { Employee } from '@gauzy/models';

@Component({
	template: `
		<ga-employee-selector
			#employeeSelector
			[skipGlobalChange]="false"
			id="authorInput"
			class="employees"
		>
		</ga-employee-selector>
	`,
	styles: []
})
export class InvoiceAddEmployeesComponent implements OnInit {
	value: any;
	rowData: any;
	selectedEmployee: Employee;

	constructor(private employeeService: EmployeesService) {}

	ngOnInit() {
		this.getEmployee();
	}

	async getEmployee() {
		const employee = await this.employeeService.getEmployeeById(
			this.rowData.employeeId
		);
		this.selectedEmployee = employee;
	}
}
