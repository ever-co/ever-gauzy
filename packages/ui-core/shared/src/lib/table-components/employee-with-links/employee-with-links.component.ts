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

	employees: any[] = [];

	constructor(private readonly store: Store, private readonly router: Router) {}

	ngOnInit(): void {
		this.initializeGrouping();
	}

	/**
	 * Initializes the grouping of employees into groups of size 3.
	 *
	 * This function takes no parameters and modifies the `employees` property of the class.
	 * It iterates over the `value` property of the class and groups employees into arrays of size 3.
	 * The resulting groups are stored in the `employees` property.
	 *
	 * @return {void} This function does not return anything.
	 */
	initializeGrouping(): void {
		const GROUP = 3;
		const SIZE = this.value.length;
		let count = 0;
		let group: any[] = [];

		for (let employee of this.value) {
			if ((2 * count - 1) % GROUP === 0) {
				group.push(employee);
				this.employees.push(group);
				group = [];
			} else {
				group.push(employee);
				if (SIZE - count < GROUP - 1 && SIZE - count > 0) {
					this.employees.push(group);
				}
			}
			count++;
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

		//
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
