import { Component, OnInit } from '@angular/core';
import { Goal, KeyResult, KeyResultUpdates } from '@gauzy/models';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { EmployeesService } from '../../../@core/services';
import { KeyResultUpdateComponent } from '../keyresult-update/keyresult-update.component';
import { first } from 'rxjs/operators';
import { KeyResultService } from '../../../@core/services/keyresult.service';
import { GoalService } from '../../../@core/services/goal.service';
import { AlertModalComponent } from '../../../@shared/alert-modal/alert-modal.component';

@Component({
	selector: 'ga-goal-details',
	templateUrl: './goal-details.component.html',
	styleUrls: ['./goal-details.component.scss']
})
export class GoalDetailsComponent implements OnInit {
	goal: Goal;
	src: string;
	ownerName: string;
	updates: Array<KeyResultUpdates> = [];
	constructor(
		private dialogRef: NbDialogRef<GoalDetailsComponent>,
		private employeeService: EmployeesService,
		private dialogService: NbDialogService,
		private keyResultService: KeyResultService,
		private goalService: GoalService
	) {}

	async ngOnInit() {
		const employee = await this.employeeService.getEmployeeById(
			this.goal.owner.id,
			['user']
		);
		this.src = employee.user.imageUrl;
		this.ownerName = employee.user.name;
		this.goal.keyResults.forEach((keyResult) => {
			this.updates.push(...keyResult.updates);
		});
	}

	async deleteGoal() {
		const dialog = this.dialogService.open(AlertModalComponent, {
			context: {
				alertOptions: {
					title: 'Delete Objective',
					message: 'Are you sure? This action is irreversible.',
					status: 'danger'
				}
			}
		});
		const response = await dialog.onClose.pipe(first()).toPromise();
		if (!!response) {
			if (response === 'yes') {
				await this.goalService
					.delete(this.goal.id)
					.catch((error) => console.log(error));
				this.dialogRef.close('deleted');
			}
		}
	}

	async keyResultUpdate(selectedKeyResult) {
		const dialog = this.dialogService.open(KeyResultUpdateComponent, {
			hasScroll: true,
			context: {
				keyResult: selectedKeyResult
			}
		});
		const response = await dialog.onClose.pipe(first()).toPromise();
		if (!!response) {
			const keyResultData = response;
			delete keyResultData.goal;
			delete keyResultData.updates;
			await this.keyResultService.update(
				selectedKeyResult.id,
				keyResultData
			);
			const keyResNumber = this.goal.keyResults.length * 100;
			this.goal.progress = this.calculateGoalProgress(
				keyResNumber,
				this.goal.keyResults
			);
		}
	}

	calculateGoalProgress(totalCount, keyResults) {
		const progressTotal = keyResults.reduce(
			(a: number, b: KeyResult) => a + b.progress,
			0
		);
		return (progressTotal / totalCount) * 100;
	}

	closeDialog() {
		this.dialogRef.close(this.goal);
	}
}
