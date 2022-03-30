import { Component, Input, OnInit } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';
import { Router } from '@angular/router';
import { ISelectedEmployee } from '@gauzy/contracts';
import { ALL_EMPLOYEES_SELECTED } from '../../../@theme/components/header/selectors/employee';
import { Store } from '../../../@core/services/store.service';

@Component({
	selector: 'ngx-employee-with-links',
	templateUrl: './employee-with-links.component.html',
	styleUrls: ['./employee-with-links.component.scss']
})
export class EmployeeWithLinksComponent implements ViewCell, OnInit {
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
		let count = 0;
		let group: any[] = [];

		for (let employee of this.value) {
			if (count % GROUP === 0) {
				group.push(employee);
				this.employees.push(group);
				group = [];
			} else {
				group.push(employee);
			}
			count++;
		}
		this.employees = this.employees.reverse();
	}

	selectEmployee(
		employee: ISelectedEmployee,
		firstName: string,
		lastName: string,
		imageUrl: string
	) {
		this.store.selectedEmployee = employee || ALL_EMPLOYEES_SELECTED;
		this.store.selectedEmployee.firstName = firstName;
		this.store.selectedEmployee.lastName = lastName;
		this.store.selectedEmployee.imageUrl = imageUrl;
		this.navigateToEmployeeStatistics();
	}

	navigateToEmployeeStatistics() {
		this.router.navigate(['/pages/dashboard/hr']);
	}
}
