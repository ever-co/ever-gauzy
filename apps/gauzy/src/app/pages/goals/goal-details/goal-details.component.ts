import { Component, OnInit } from '@angular/core';
import { KeyResult } from '@gauzy/models';
import { NbDialogRef } from '@nebular/theme';
import { EmployeesService } from '../../../@core/services';

@Component({
	selector: 'ga-goal-details',
	templateUrl: './goal-details.component.html',
	styleUrls: ['./goal-details.component.scss']
})
export class GoalDetailsComponent implements OnInit {
	name: string;
	owner: string;
	src: string;
	ownerName: string;
	deadline: string;
	description: string;
	progress: number;
	keyResults: Array<KeyResult>;
	constructor(
		private dialogRef: NbDialogRef<GoalDetailsComponent>,
		private employeeService: EmployeesService
	) {}

	async ngOnInit() {
		console.log(this.name);
		const employee = await this.employeeService.getEmployeeById(
			this.owner,
			['user']
		);
		console.log(employee);
		this.src = employee.user.imageUrl;
		this.ownerName = employee.user.name;
	}

	closeDialog() {
		this.dialogRef.close();
	}
}
