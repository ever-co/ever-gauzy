import { Component, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IEmployee, ISelectedEmployee } from '@gauzy/contracts';
import { ALL_EMPLOYEES_SELECTED } from '../../../@theme/components/header/selectors/employee';
import { Store } from '@gauzy/ui-sdk/common';

@Component({
	selector: 'ngx-employee-with-links',
	templateUrl: './employee-with-links.component.html',
	styleUrls: ['./employee-with-links.component.scss']
})
export class EmployeeWithLinksComponent implements OnInit {
	@Input()
	rowData: any;

	@Input()
	value: any;

	employees: any[] = [];

	constructor(private store: Store, private readonly router: Router) {}

	ngOnInit(): void {
		this.initializeGrouping();
	}

	initializeGrouping() {
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

	selectEmployee(employee: ISelectedEmployee, firstName: string, lastName: string, imageUrl: string) {
		this.store.selectedEmployee = employee || ALL_EMPLOYEES_SELECTED;
		this.store.selectedEmployee.firstName = firstName;
		this.store.selectedEmployee.lastName = lastName;
		this.store.selectedEmployee.imageUrl = imageUrl;
		this.navigateToEmployeeStatistics(employee?.id);
	}

	navigateToEmployeeStatistics(id: IEmployee['id']) {
		this.router.navigate([`/pages/employees/edit/${id}/account`]);
	}
}
