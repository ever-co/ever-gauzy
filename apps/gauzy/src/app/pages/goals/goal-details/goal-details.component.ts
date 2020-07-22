import { Component, OnInit } from '@angular/core';
import { Goal, KeyResult, KeyResultUpdates } from '@gauzy/models';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { EmployeesService } from '../../../@core/services';
import { KeyResultUpdateComponent } from '../keyresult-update/keyresult-update.component';
import { first } from 'rxjs/operators';
import { KeyResultService } from '../../../@core/services/keyresult.service';
import { GoalService } from '../../../@core/services/goal.service';
import { AlertModalComponent } from '../../../@shared/alert-modal/alert-modal.component';
import { KeyResultDetailsComponent } from '../keyresult-details/keyresult-details.component';
import { ToastrService } from '../../../@core/services/toastr.service';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';

@Component({
	selector: 'ga-goal-details',
	templateUrl: './goal-details.component.html',
	styleUrls: ['./goal-details.component.scss']
})
export class GoalDetailsComponent extends TranslationBaseComponent
	implements OnInit {
	goal: Goal;
	src: string;
	ownerName: string;
	updates: Array<KeyResultUpdates> = [];
	constructor(
		private dialogRef: NbDialogRef<GoalDetailsComponent>,
		private employeeService: EmployeesService,
		private dialogService: NbDialogService,
		private keyResultService: KeyResultService,
		private goalService: GoalService,
		private toastrService: ToastrService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	async ngOnInit() {
		if (!!this.goal.ownerEmployee) {
			const employee = await this.employeeService.getEmployeeById(
				this.goal.ownerEmployee.id,
				['user']
			);
			this.src = employee.user.imageUrl;
			this.ownerName = employee.user.name;
		} else if (!!this.goal.ownerOrg) {
			this.ownerName = this.goal.ownerOrg.name;
			this.src = this.goal.ownerOrg.imageUrl;
		} else {
			this.ownerName = this.goal.ownerTeam.name;
		}

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
			},
			closeOnBackdropClick: false
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

	async keyResultDetails(index, selectedKeyResult) {
		const dialog = this.dialogService.open(KeyResultDetailsComponent, {
			hasScroll: true,
			context: {
				keyResult: selectedKeyResult
			},
			closeOnBackdropClick: false
		});
		const response = await dialog.onClose.pipe(first()).toPromise();
		if (!!response) {
			if (response === 'deleted') {
				this.goal.keyResults.splice(index, 1);
				this.toastrService.danger(
					this.getTranslation('TOASTR.MESSAGE.KEY_RESULT_DELETED'),
					this.getTranslation('TOASTR.TITLE.SUCCESS')
				);
			} else if (!!index) {
				this.goal.keyResults[index] = response;
				this.goal.progress = this.calculateGoalProgress(
					this.goal.keyResults
				);
			}
		}
	}

	async keyResultUpdate(selectedKeyResult) {
		const dialog = this.dialogService.open(KeyResultUpdateComponent, {
			hasScroll: true,
			context: {
				keyResult: selectedKeyResult
			},
			closeOnBackdropClick: false
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
			this.goal.progress = this.calculateGoalProgress(
				this.goal.keyResults
			);
		}
	}

	calculateGoalProgress(keyResults) {
		const progressTotal = keyResults.reduce(
			(a: number, b: KeyResult) => a + b.progress * +b.weight,
			0
		);
		const weightTotal = keyResults.reduce((a, b) => a + +b.weight, 0);
		return Math.round(progressTotal / weightTotal);
	}

	closeDialog() {
		this.dialogRef.close(this.goal);
	}
}
