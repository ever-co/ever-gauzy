import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { GoalTemplatesService } from '../../../@core/services/goal-templates.service';
import {
	GoalTemplate,
	GoalTimeFrame,
	TimeFrameStatusEnum,
	Employee,
	OrganizationTeam,
	GoalLevelEnum,
	KeyResultWeightEnum,
	KeyResultTypeEnum
} from '@gauzy/models';
import { GoalSettingsService } from '../../../@core/services/goal-settings.service';
import { Store } from '../../../@core/services/store.service';
import { isFuture } from 'date-fns';
import {
	NbDialogRef,
	NbDialogService,
	NbStepperComponent
} from '@nebular/theme';
import { EditTimeFrameComponent } from '../../../pages/goal-settings/edit-time-frame/edit-time-frame.component';
import { first, takeUntil } from 'rxjs/operators';
import { GoalService } from '../../../@core/services/goal.service';
import { EmployeesService } from '../../../@core/services';
import { Subject } from 'rxjs';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { KeyResultService } from '../../../@core/services/keyresult.service';

@Component({
	selector: 'ga-goal-template-select',
	templateUrl: './goal-template-select.component.html',
	styleUrls: ['./goal-template-select.component.scss']
})
export class GoalTemplateSelectComponent implements OnInit, OnDestroy {
	goalTemplates: GoalTemplate[];
	selectedGoalTemplate: GoalTemplate;
	timeFrames: GoalTimeFrame[] = [];
	timeFrameStatusEnum = TimeFrameStatusEnum;
	employees: Employee[];
	teams: OrganizationTeam[] = [];
	orgId: string;
	orgName: string;
	goalDetailsForm: FormGroup;
	private _ngDestroy$ = new Subject<void>();

	@ViewChild('stepper') stepper: NbStepperComponent;

	constructor(
		private goalTemplateService: GoalTemplatesService,
		private goalSettingService: GoalSettingsService,
		private store: Store,
		private dialogRef: NbDialogRef<GoalTemplateSelectComponent>,
		private dialogService: NbDialogService,
		private goalService: GoalService,
		private keyResultService: KeyResultService,
		private employeeService: EmployeesService,
		private fb: FormBuilder,
		private goalSettingsService: GoalSettingsService
	) {}

	async ngOnInit() {
		this.goalDetailsForm = this.fb.group({
			deadline: ['', Validators.required],
			owner: ['', Validators.required],
			level: [
				!!this.selectedGoalTemplate
					? this.selectedGoalTemplate.level
					: GoalLevelEnum.ORGANIZATION,
				Validators.required
			],
			lead: [null]
		});
		await this.getTimeFrames();
		this.goalTemplateService.getAllGoalTemplates().then((res) => {
			const { items } = res;
			console.log(items);
			this.goalTemplates = items;
		});
		await this.employeeService
			.getAll(['user'])
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((employees) => {
				this.employees = employees.items;
			});
	}

	async getTimeFrames() {
		const findObj = {
			organization: {
				id: this.store.selectedOrganization.id
			}
		};
		await this.goalSettingService.getAllTimeFrames(findObj).then((res) => {
			if (res) {
				this.timeFrames = res.items.filter(
					(timeframe) =>
						timeframe.status === this.timeFrameStatusEnum.ACTIVE &&
						isFuture(new Date(timeframe.endDate))
				);
			}
		});
	}

	async openSetTimeFrame() {
		const dialog = this.dialogService.open(EditTimeFrameComponent, {
			context: {
				type: 'add'
			},
			closeOnBackdropClick: false
		});
		const response = await dialog.onClose.pipe(first()).toPromise();
		if (response) {
			await this.getTimeFrames();
		}
	}

	nextStep(goalTemplate) {
		this.stepper.next();
		this.selectedGoalTemplate = goalTemplate;
	}

	async createGoal() {
		if (!!this.selectedGoalTemplate && !!this.goalDetailsForm.valid) {
			const goalDetailsFormValue = this.goalDetailsForm.value;
			delete goalDetailsFormValue.level;
			const goal = {
				...this.selectedGoalTemplate,
				...goalDetailsFormValue,
				description: ' ',
				progress: 0,
				organizationId: this.store.selectedOrganization.id
			};
			goal[
				this.goalDetailsForm.value.level === GoalLevelEnum.EMPLOYEE
					? 'ownerEmployee'
					: this.goalDetailsForm.value.level === GoalLevelEnum.TEAM
					? 'ownerTeam'
					: 'ownerOrg'
			] = this.goalDetailsForm.value.owner;
			delete goal.owner;
			delete goal.keyResults;
			const goalCreated = await this.goalService.createGoal(goal);
			if (goalCreated) {
				const kpicreatedPromise = [];
				this.selectedGoalTemplate.keyResults.forEach(
					async (keyResult) => {
						if (keyResult.type === KeyResultTypeEnum.KPI) {
							const kpiData = {
								...keyResult.kpi,
								organization: this.orgId
							};
							await this.goalSettingsService
								.createKPI(kpiData)
								.then((res) => {
									if (res) {
										keyResult.kpiId = res.id;
									}
									kpicreatedPromise.push(keyResult);
								});
						}
					}
				);
				Promise.all(kpicreatedPromise).then(async () => {
					const keyResults = this.selectedGoalTemplate.keyResults.map(
						(keyResult) => {
							delete keyResult.kpi;
							delete keyResult.goalId;
							return {
								...keyResult,
								goalId: goalCreated.id,
								description: ' ',
								progress: 0,
								update: keyResult.initialValue,
								owner: this.employees[0].id,
								organizationId: this.orgId,
								status: 'none',
								weight: KeyResultWeightEnum.DEFAULT
							};
						}
					);

					console.log(keyResults);
					await this.keyResultService
						.createBulkKeyResult(keyResults)
						.then((res) => {
							if (res) {
								this.closeDialog('done');
							}
						});
				});
			}
		}
	}

	previousStep() {
		this.stepper.previous();
	}

	closeDialog(data) {
		this.dialogRef.close(data);
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
