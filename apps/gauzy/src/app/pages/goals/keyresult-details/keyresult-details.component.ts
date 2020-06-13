import { Component, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { EmployeesService } from '../../../@core/services';

@Component({
	selector: 'ga-keyresult-details',
	templateUrl: './keyresult-details.component.html',
	styleUrls: ['./keyresult-details.component.scss']
})
export class KeyresultDetailsComponent implements OnInit {
	owner: string;
	src: string;
	ownerName: string;
	constructor(
		private dialogRef: NbDialogRef<KeyresultDetailsComponent>,
		private employeeService: EmployeesService
	) {}

	async ngOnInit() {
		const employee = await this.employeeService.getEmployeeById(
			this.owner,
			['user']
		);
		this.src = employee.user.imageUrl;
		this.ownerName = employee.user.name;
	}

	closeDialog() {
		this.dialogRef.close();
	}
}
