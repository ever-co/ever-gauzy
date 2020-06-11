import { Component, OnInit } from '@angular/core';
import { KeyResult, Goals } from '@gauzy/models';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { EmployeesService } from '../../../@core/services';
import { KeyresultUpdateComponent } from '../keyresult-update/keyresult-update.component';
import { first } from 'rxjs/operators';

@Component({
	selector: 'ga-goal-details',
	templateUrl: './goal-details.component.html',
	styleUrls: ['./goal-details.component.scss']
})
export class GoalDetailsComponent implements OnInit {
	goal: Goals;
	src: string;
	ownerName: string;
	constructor(
		private dialogRef: NbDialogRef<GoalDetailsComponent>,
		private employeeService: EmployeesService,
		private dialogService: NbDialogService
	) {}

	async ngOnInit() {
		const employee = await this.employeeService.getEmployeeById(
			this.goal.owner,
			['user']
		);
		this.src = employee.user.imageUrl;
		this.ownerName = employee.user.name;
	}

	async keyResultUpdate(selectedkeyResult) {
		const dialog = this.dialogService.open(KeyresultUpdateComponent, {
			hasScroll: true,
			context: {
				keyResult: selectedkeyResult
			}
		});
		const response = await dialog.onClose.pipe(first()).toPromise();
		if (!!response) {
			const keyResultIndex = this.goal.keyResults.findIndex(
				(element) => element.name === selectedkeyResult.name
			);
			this.goal.keyResults[keyResultIndex] = response;
			const keyResNumber = this.goal.keyResults.length * 100;
			this.goal.progress = this.calculateGoalProgress(
				keyResNumber,
				this.goal.keyResults
			);
		}
	}

	calculateGoalProgress(totalCount, keyResults) {
		console.table(keyResults);
		const progressTotal = keyResults.reduce((a, b) => a + b.progress, 0);
		console.log((progressTotal / totalCount) * 100);
		return (progressTotal / totalCount) * 100;
	}

	closeDialog() {
		this.dialogRef.close(this.goal);
	}
}
