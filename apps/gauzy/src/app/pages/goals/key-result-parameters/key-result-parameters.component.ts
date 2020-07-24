import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import {
	KeyResultTypeEnum,
	KeyResult,
	KeyResultWeightEnum,
	KeyResultDeadlineEnum,
	KPI
} from '@gauzy/models';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { KeyResultService } from '../../../@core/services/keyresult.service';
import { Subject } from 'rxjs';
import { takeUntil, first } from 'rxjs/operators';
import { TasksService } from '../../../@core/services/tasks.service';
import { GoalSettingsService } from '../../../@core/services/goal-settings.service';
import { EditKpiComponent } from '../../goal-settings/edit-kpi/edit-kpi.component';

@Component({
	selector: 'ga-key-result-parameters',
	templateUrl: './key-result-parameters.component.html'
})
export class KeyResultParametersComponent implements OnInit, OnDestroy {
	weightForm: FormGroup;
	typeForm: FormGroup;
	data: { selectedKeyResult: KeyResult; allKeyResults: KeyResult[] };
	keyResultTypeEnum = KeyResultTypeEnum;
	keyResultWeightEnum = KeyResultWeightEnum;
	keyResultWeight: any;
	KPIs: KPI[];
	private _ngDestroy$ = new Subject<void>();
	constructor(
		private fb: FormBuilder,
		private dialogRef: NbDialogRef<KeyResultParametersComponent>,
		private keyResultService: KeyResultService,
		private taskService: TasksService,
		private goalSettingsService: GoalSettingsService,
		private dialogService: NbDialogService
	) {}

	async ngOnInit() {
		this.weightForm = this.fb.group({
			weight: [KeyResultWeightEnum.DEFAULT, Validators.required]
		});
		this.typeForm = this.fb.group({
			type: [KeyResultTypeEnum.NUMBER, Validators.required],
			targetValue: [1],
			initialValue: [0],
			projectId: [null],
			taskId: [null],
			kpiId: ['']
		});

		await this.getKPI();
		if (!!this.data.selectedKeyResult) {
			this.typeForm.patchValue({
				type: this.data.selectedKeyResult.type,
				targetValue: this.data.selectedKeyResult.targetValue,
				initialValue: this.data.selectedKeyResult.initialValue,
				projectId: this.data.selectedKeyResult.projectId,
				taskId: this.data.selectedKeyResult.taskId,
				kpiId: this.data.selectedKeyResult.kpiId
			});
			this.weightForm.patchValue({
				weight: this.data.selectedKeyResult.weight
			});
			const allKeyResult = JSON.parse(
				JSON.stringify(this.data.allKeyResults)
			);
			let weightSum = this.data.allKeyResults.reduce(
				(a, b) => a + +b.weight,
				0
			);
			this.keyResultWeight = Math.round(
				+this.weightForm.value.weight * (100 / weightSum)
			);
			this.weightForm.controls['weight'].valueChanges
				.pipe(takeUntil(this._ngDestroy$))
				.subscribe((weight) => {
					allKeyResult.find(
						(element) =>
							element.id === this.data.selectedKeyResult.id
					).weight = weight;
					weightSum = allKeyResult.reduce((a, b) => a + +b.weight, 0);
					this.keyResultWeight = Math.round(
						+weight * (100 / weightSum)
					);
				});
		}
	}

	async getKPI() {
		await this.goalSettingsService.getAllKPI().then((kpi) => {
			const { items } = kpi;
			this.KPIs = items;
		});
	}

	async updateKeyResult() {
		if (this.typeForm.value.type === this.keyResultTypeEnum.TASK) {
			await this.taskService
				.getById(this.typeForm.value.taskId)
				.then((task) => {
					if (!!task.dueDate) {
						this.typeForm.patchValue({
							deadline: KeyResultDeadlineEnum.HARD_DEADLINE,
							hardDeadline: task.dueDate
						});
					}
				});
		}
		this.data.selectedKeyResult.type = this.typeForm.value.type;
		this.data.selectedKeyResult.targetValue = this.typeForm.value.targetValue;
		this.data.selectedKeyResult.initialValue = this.typeForm.value.initialValue;
		this.data.selectedKeyResult.weight = this.weightForm.value.weight;
		this.keyResultService.update(this.data.selectedKeyResult.id, {
			...this.data.selectedKeyResult
		});
		this.closeDialog(this.data.selectedKeyResult);
	}

	async openEditKPI() {
		const dialog = this.dialogService.open(EditKpiComponent, {
			context: {
				type: 'add'
			}
		});
		const response = await dialog.onClose.pipe(first()).toPromise();
		if (!!response) {
			await this.getKPI();
		}
	}

	taskTypeValidators() {
		if (this.typeForm.get('type').value === this.keyResultTypeEnum.TASK) {
			this.typeForm.controls['projectId'].setValidators([
				Validators.required
			]);
			this.typeForm.controls['taskId'].setValidators([
				Validators.required
			]);
		} else {
			this.typeForm.controls['projectId'].clearValidators();
			this.typeForm.patchValue({ projectId: undefined });
			this.typeForm.controls['taskId'].clearValidators();
			this.typeForm.patchValue({ taskId: undefined });
		}
		this.typeForm.controls['projectId'].updateValueAndValidity();
		this.typeForm.controls['taskId'].updateValueAndValidity();
	}

	closeDialog(data) {
		this.dialogRef.close(data);
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
