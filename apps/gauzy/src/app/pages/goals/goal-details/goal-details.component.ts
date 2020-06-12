import { Component, OnInit } from '@angular/core';
import { Goals, KeyResult } from '@gauzy/models';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { EmployeesService } from '../../../@core/services';
import { KeyresultUpdateComponent } from '../keyresult-update/keyresult-update.component';
import { first } from 'rxjs/operators';
import { KeyresultService } from '../../../@core/services/keyresult.service';

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
		private dialogService: NbDialogService,
		private keyResultService: KeyresultService
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
			await this.keyResultService.update(selectedkeyResult.id, response);
			const keyResNumber = this.goal.keyResults.length * 100;
			this.goal.progress = this.calculateGoalProgress(
				keyResNumber,
				this.goal.keyResults
			);
		}
	}

	calculateGoalProgress(totalCount, keyResults) {
		console.table(keyResults);
		const progressTotal = keyResults.reduce(
			(a: number, b: KeyResult) => a + b.progress,
			0
		);
		console.log((progressTotal / totalCount) * 100);
		return (progressTotal / totalCount) * 100;
	}

	closeDialog() {
		this.dialogRef.close(this.goal);
	}
}
