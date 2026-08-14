import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import { IEmployee, ISelectedEmployee } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { IPersonListItem } from '../people-list/people-list.component';

/**
 * Grid cell renderer for "the people on this record" — Members, Managers,
 * Employees, Interviewers, Assigned To.
 *
 * The rendering itself lives in `ngx-people-list`, which is shared with every
 * other people column so they all look the same; this component only owns the
 * navigation that is specific to an employee.
 */
@Component({
	selector: 'ngx-employee-with-links',
	templateUrl: './employee-with-links.component.html',
	standalone: false
})
export class EmployeeWithLinksComponent {
	@Input() rowData: any;
	@Input() value: any;

	constructor(private readonly store: Store, private readonly router: Router) {}

	/**
	 * Selects an employee and opens their statistics page.
	 *
	 * @param person The person that was clicked in the list.
	 */
	selectEmployee(person: IPersonListItem): void {
		const employee = person?.raw;

		if (!employee?.id) {
			return;
		}

		this.store.selectedEmployee = {
			...employee,
			firstName: employee?.user?.firstName,
			lastName: employee?.user?.lastName,
			imageUrl: person.imageUrl
		} as ISelectedEmployee;

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
