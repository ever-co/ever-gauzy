import { Component, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IEmployee, ISelectedEmployee } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';

@Component({
	selector: 'ngx-employee-with-links',
	templateUrl: './employee-with-links.component.html',
	styleUrls: ['./employee-with-links.component.scss']
})
export class EmployeeWithLinksComponent implements OnInit {
	@Input() rowData: any;
	@Input() value: any;

	employees: ISelectedEmployee[] = [];
	maxVisible: number = 5;
	remainingCount: number = 0;

	constructor(private readonly store: Store, private readonly router: Router) {}

	ngOnInit(): void {
		this.initializeEmployees();
	}

	/**
	 * Initializes the employees array with visible employees and calculates remaining count
	 *
	 * @return {void} This function does not return anything.
	 */
	initializeEmployees(): void {
		if (!this.value || !Array.isArray(this.value)) {
			return;
		}

		// Calculate how many items should be shown vs hidden
		if (this.value.length > this.maxVisible) {
			this.employees = this.value.slice(0, this.maxVisible);
			this.remainingCount = this.value.length - this.maxVisible;
		} else {
			this.employees = [...this.value];
			this.remainingCount = 0;
		}
	}

	/**
	 * Selects an employee and updates the store with the selected employee's information.
	 *
	 * @param {ISelectedEmployee} employee - The employee to be selected.
	 * @param {string} firstName - The first name of the selected employee.
	 * @param {string} lastName - The last name of the selected employee.
	 * @param {string} imageUrl - The URL of the selected employee's image.
	 * @return {void} This function does not return anything.
	 */
	selectEmployee(employee: ISelectedEmployee, firstName: string, lastName: string, imageUrl: string): void {
		this.store.selectedEmployee = employee;
		this.store.selectedEmployee.firstName = firstName;
		this.store.selectedEmployee.lastName = lastName;
		this.store.selectedEmployee.imageUrl = imageUrl;

		this.navigateToEmployeeStatistics(employee.id);
	}

	/**
	 * Navigates to the employee statistics page.
	 *
	 * @param {IEmployee['id']} id - The ID of the employee.
	 * @return {void} This function does not return a value.
	 */
	navigateToEmployeeStatistics(id: IEmployee['id']): void {
		if (id) this.router.navigate([`/pages/employees/edit/${id}/account`]);
	}
}
