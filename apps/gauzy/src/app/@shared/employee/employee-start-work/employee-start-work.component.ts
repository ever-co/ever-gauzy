import {Component} from '@angular/core';
import {EmployeeEndWorkComponent} from "../employee-end-work-popup/employee-end-work.component";
import {NbDialogRef} from "@nebular/theme";

@Component({
	selector: 'ga-employee-start-work',
	templateUrl: './employee-start-work.component.html',
	styleUrls: ['./employee-start-work.component.scss']
})
export class EmployeeStartWorkComponent {
	startWorkValue: Date;
	employeeFullName: string;

	constructor(
		protected dialogRef: NbDialogRef<EmployeeEndWorkComponent>
	) {
	}

	closeDialog() {
		this.dialogRef.close();
	}

	startWork() {
		this.dialogRef.close(this.startWorkValue || new Date());
	}
}
