import { Component, Input, OnInit } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';
import { IEmployee } from '@gauzy/contracts';
import { Router } from '@angular/router';

@Component({
	selector: 'gauzy-project-organization-employees',
	templateUrl: './project-organization-employees.component.html',
	styleUrls: ['./project-organization-employees.component.scss']
})
export class ProjectOrganizationEmployeesComponent implements OnInit, ViewCell {
	@Input()
	value: string | number;
	@Input()
	rowData: any;
	employeesFirstHalf: IEmployee[] = [];
	employeesLastHalf: IEmployee[] = [];

	constructor(private readonly router: Router) {}

	ngOnInit(): void {
		if (this.rowData.members.length > 0) {
			const size: number = this.rowData.members.length;
			const half: number = size / 2;
			this.employeesFirstHalf = this.rowData.members.splice(
				0,
				Math.ceil(half)
			);
			this.employeesLastHalf = this.rowData.members;
      this.employeesFirstHalf[0]
		}
	}

	edit(id: string) {
		if (id) {
			this.router.navigate(['/pages/employees/edit/' + id]);
		}
	}
}
