import { Component, OnInit, OnDestroy } from '@angular/core';
import { UntypedFormGroup, UntypedFormBuilder, Validators } from '@angular/forms';
import {
	KeyResultTypeEnum,
	IKeyResult,
	KeyResultWeightEnum,
	KeyResultDeadlineEnum,
	IKPI,
	IGoalGeneralSetting,
	KeyResultNumberUnitsEnum,
	IOrganization
} from '@gauzy/contracts';
import { NbDialogRef } from '@nebular/theme';
import { KeyResultService } from '../../../@core/services/keyresult.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TasksService } from '../../../@core/services/tasks.service';
import { GoalSettingsService } from '../../../@core/services/goal-settings.service';
import { Store } from '@gauzy/ui-sdk/common';
@Component({
	selector: 'ga-key-result-parameters',
	templateUrl: './key-result-parameters.component.html',
	styleUrls: ['../edit-keyresults/edit-keyresults.component.scss']
})
export class KeyResultParametersComponent implements OnInit, OnDestroy {
	weightForm: UntypedFormGroup;
	typeForm: UntypedFormGroup;
	data: {
		selectedKeyResult: IKeyResult;
		allKeyResults: IKeyResult[];
		settings: IGoalGeneralSetting;
		orgId: string;
	};
	keyResultTypeEnum = KeyResultTypeEnum;
	keyResultWeightEnum = KeyResultWeightEnum;
	keyResultWeight: any;
	KPIs: IKPI[];
	numberUnitsEnum: string[] = Object.values(KeyResultNumberUnitsEnum);
	private _ngDestroy$ = new Subject<void>();
	organization: IOrganization;
	constructor(
		private fb: UntypedFormBuilder,
		private dialogRef: NbDialogRef<KeyResultParametersComponent>,
		private keyResultService: KeyResultService,
		private taskService: TasksService,
		private goalSettingsService: GoalSettingsService,
		private store: Store
	) {}

	async ngOnInit() {
		this.organization = this.store.selectedOrganization;
		this.weightForm = this.fb.group({
			weight: [KeyResultWeightEnum.DEFAULT, Validators.required]
		});
		this.typeForm = this.fb.group({
			type: [KeyResultTypeEnum.NUMERICAL, Validators.required],
			targetValue: [1],
			initialValue: [0],
			projectId: [null],
			taskId: [null],
			kpiId: [''],
			unit: [KeyResultNumberUnitsEnum.ITEMS]
		});

		await this.getKPI();
		if (!!this.data.selectedKeyResult) {
			if (!this.numberUnitsEnum.find((unit) => unit === this.data.selectedKeyResult.unit)) {
				this.numberUnitsEnum.push(this.data.selectedKeyResult.unit);
			}
			this.typeForm.patchValue({
				type: this.data.selectedKeyResult.type,
				targetValue: this.data.selectedKeyResult.targetValue,
				initialValue: this.data.selectedKeyResult.initialValue,
				projectId: this.data.selectedKeyResult.projectId,
				taskId: this.data.selectedKeyResult.taskId,
				kpiId: this.data.selectedKeyResult.kpiId,
				unit: this.data.selectedKeyResult.unit
			});
			this.weightForm.patchValue({
				weight: this.data.selectedKeyResult.weight
			});
			const allKeyResult = JSON.parse(JSON.stringify(this.data.allKeyResults));
			let weightSum = this.data.allKeyResults.reduce((a, b) => a + +b.weight, 0);
			this.keyResultWeight = Math.round(+this.weightForm.value.weight * (100 / weightSum));
			this.weightForm.controls['weight'].valueChanges.pipe(takeUntil(this._ngDestroy$)).subscribe((weight) => {
				allKeyResult.find((element) => element.id === this.data.selectedKeyResult.id).weight = weight;
				weightSum = allKeyResult.reduce((a, b) => a + +b.weight, 0);
				this.keyResultWeight = Math.round(+weight * (100 / weightSum));
			});
		}
	}

	async getKPI() {
		const { id: organizationId, tenantId } = this.organization;
		await this.goalSettingsService.getAllKPI({ organization: { id: organizationId }, tenantId }).then((kpi) => {
			const { items } = kpi;
			this.KPIs = items;
		});
	}

	async updateKeyResult() {
		if (this.typeForm.value.type === this.keyResultTypeEnum.TASK) {
			await this.taskService.getById(this.typeForm.value.taskId).then((task) => {
				if (!!task.dueDate) {
					this.typeForm.patchValue({
						deadline: KeyResultDeadlineEnum.HARD_DEADLINE,
						hardDeadline: task.dueDate
					});
				}
			});
		}
		if (this.typeForm.value.type === this.keyResultTypeEnum.KPI) {
			this.data.selectedKeyResult.kpiId = this.typeForm.value.kpiId;
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

	closeDialog(data) {
		this.dialogRef.close(data);
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
