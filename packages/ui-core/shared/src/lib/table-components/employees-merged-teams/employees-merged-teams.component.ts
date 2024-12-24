import { Component, Input, OnInit } from '@angular/core';
import { IEmployee } from '@gauzy/contracts';

@Component({
	selector: 'ngx-employees-merged-teams',
	templateUrl: './employees-merged-teams.component.html',
	styleUrls: ['./employees-merged-teams.component.scss']
})
export class EmployeesMergedTeamsComponent implements OnInit {
	@Input() value: any;
	@Input() rowData: any;

	public employees: IEmployee[] = [];

	ngOnInit(): void {
		if (this.value) {
			const buffers = this.value[1];
			if (buffers) {
				for (let buffer of buffers) {
					for (let member of buffer.members) {
						this.employees.push(member.employee);
					}
				}
			}
		}
	}
}
