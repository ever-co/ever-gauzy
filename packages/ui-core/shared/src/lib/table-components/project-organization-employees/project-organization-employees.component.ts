import { Component, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ID, IEmployee } from '@gauzy/contracts';

@Component({
    selector: 'gauzy-project-organization-employees',
    templateUrl: './project-organization-employees.component.html',
    styleUrls: ['./project-organization-employees.component.scss'],
    standalone: false
})
export class ProjectOrganizationEmployeesComponent implements OnInit {
	@Input() value: string | number;
	@Input() rowData: any;

	employeesFirstHalf: IEmployee[] = [];
	employeesLastHalf: IEmployee[] = [];

	constructor(readonly router: Router) {}

	/**
	 * Lifecycle hook that is called after data-bound properties are initialized.
	 * Splits the members into two halves for display.
	 */
	ngOnInit(): void {
		this.splitEmployeesIntoHalves();
	}

	/**
	 * Splits the members array into two halves: first half and last half.
	 */
	private splitEmployeesIntoHalves(): void {
		const members = this.rowData?.members || [];
		const halfIndex = Math.ceil(members.length / 2);

		this.employeesFirstHalf = members.slice(0, halfIndex);
		this.employeesLastHalf = members.slice(halfIndex);
	}

	/**
	 * Navigates to the employee edit page based on the provided employee ID.
	 *
	 * @param id - The ID of the employee to edit.
	 */
	edit(id: ID): void {
		if (id) {
			this.router.navigate([`/pages/employees/edit/${id}`]);
		}
	}

	/**
	 * Tracks employees by their unique ID to optimize ngFor performance.
	 * @param index - The index of the item in the list.
	 * @param member - The employee member object.
	 * @returns The unique ID of the employee.
	 */
	trackByEmployeeId(index: number, member: IEmployee): ID {
		return member.employee?.id;
	}
}
