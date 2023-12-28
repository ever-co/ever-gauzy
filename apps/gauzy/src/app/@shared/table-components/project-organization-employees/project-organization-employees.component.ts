import { Component, Input, OnInit } from '@angular/core';
import { IEmployee } from '@gauzy/contracts';
import { Router } from '@angular/router';

@Component({
	selector: 'gauzy-project-organization-employees',
	templateUrl: './project-organization-employees.component.html',
	styleUrls: ['./project-organization-employees.component.scss']
})
export class ProjectOrganizationEmployeesComponent implements OnInit {
	@Input()
	value: string | number;
	@Input()
	rowData: any;
	employeesFirstHalf: IEmployee[] = [];
	employeesLastHalf: IEmployee[] = [];

	constructor(private readonly router: Router) { }

	ngOnInit(): void {
		if (this.rowData.members.length > 0) {
			const size: number = this.rowData.members.length;
			const half: number = size / 2;
			for (let i = 0; i < size; i++) {
				if (i < Math.ceil(half)) {
					this.employeesFirstHalf[i] = this.rowData.members[i];
				} else {
					this.employeesLastHalf[i - Math.ceil(half)] =
						this.rowData.members[i];
				}
			}
		}
	}

	edit(id: string) {
		if (id) {
			this.router.navigate(['/pages/employees/edit/' + id]);
		}
	}
}
