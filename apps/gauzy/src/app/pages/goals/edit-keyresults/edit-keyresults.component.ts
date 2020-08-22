import { Component, OnInit, OnDestroy } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import {
	FormGroup,
	FormBuilder,
	Validators,
	FormControl
} from '@angular/forms';
import { EmployeesService } from '../../../@core/services';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import {
	Employee,
	KeyResult,
	KeyResultTypeEnum,
	KeyResultDeadlineEnum,
	KeyResultWeightEnum,
	GoalLevelEnum,
	OrganizationTeam,
	RolesEnum,
	Goal,
	KPI,
	GoalGeneralSetting,
	CurrenciesEnum,
	KeyResultNumberUnitsEnum
} from '@gauzy/models';
import { TasksService } from '../../../@core/services/tasks.service';
import { OrganizationTeamsService } from '../../../@core/services/organization-teams.service';
import { Store } from '../../../@core/services/store.service';
import { GoalService } from '../../../@core/services/goal.service';
import { GoalSettingsService } from '../../../@core/services/goal-settings.service';
import { KeyResultUpdateService } from '../../../@core/services/keyresult-update.service';
import { endOfTomorrow } from 'date-fns';

@Component({
	selector: 'ga-edit-keyresults',
	templateUrl: './edit-keyresults.component.html',
	styleUrls: ['./edit-keyresults.component.scss']
})
export class EditKeyResultsComponent implements OnInit, OnDestroy {
	employees: Employee[];
	keyResultsForm: FormGroup;
	data: KeyResult;
	showAllEmployees = false;
	settings: GoalGeneralSetting;
	orgId: string;
	orgName: string;
	currenciesEnum = CurrenciesEnum;
	numberUnitsEnum: string[] = Object.values(KeyResultNumberUnitsEnum);
	helperText = '';
	teams: OrganizationTeam[] = [];
	hideOrg = false;
	hideTeam = false;
	hideEmployee = false;
	goalLevelEnum = GoalLevelEnum;
	softDeadline: FormControl;
	keyResultTypeEnum = KeyResultTypeEnum;
	goalDeadline: string;
	keyResultDeadlineEnum = KeyResultDeadlineEnum;
	minDate = endOfTomorrow();
	KPIs: Array<KPI>;
	private _ngDestroy$ = new Subject<void>();
	constructor(
		private dialogRef: NbDialogRef<EditKeyResultsComponent>,
		public fb: FormBuilder,
		private employeeService: EmployeesService,
		private taskService: TasksService,
		private organizationTeamsService: OrganizationTeamsService,
		private store: Store,
		private goalService: GoalService,
		private goalSettingsService: GoalSettingsService,
		private keyResultUpdateService: KeyResultUpdateService
	) {}

	async ngOnInit() {
		this.keyResultsForm = this.fb.group({
			name: ['', Validators.required],
			description: [''],
			type: [this.keyResultTypeEnum.NUMERICAL, Validators.required],
			unit: [KeyResultNumberUnitsEnum.ITEMS],
			targetValue: [1],
			initialValue: [0],
			owner: [null, Validators.required],
			lead: [null],
			deadline: [
				this.keyResultDeadlineEnum.NO_CUSTOM_DEADLINE,
				Validators.required
			],
			projectId: [null],
			taskId: [null],
			softDeadline: [null],
			hardDeadline: [null],
			assignAsObjective: [false],
			level: [''],
			alignedGoalOwner: [''],
			kpiId: [null]
		});

		if (!!this.data) {
			if (!this.numberUnitsEnum.find((unit) => unit === this.data.unit)) {
				this.numberUnitsEnum.push(this.data.unit);
			}
			await this.getKPI();
			this.keyResultsForm.patchValue(this.data);
			this.keyResultsForm.patchValue({
				softDeadline: this.data.softDeadline
					? new Date(this.data.softDeadline)
					: null,
				hardDeadline: this.data.hardDeadline
					? new Date(this.data.hardDeadline)
					: null,
				lead: !!this.data.lead ? this.data.lead.id : null,
				owner: this.data.owner.id
			});
		} else {
			await this.getKPI();
		}
		this.employeeService
			.getAll(['user'])
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((employees) => {
				this.employees = employees.items;
			});

		if (
			this.store.user.role.name !== RolesEnum.SUPER_ADMIN &&
			this.store.user.role.name !== RolesEnum.MANAGER &&
			this.store.user.role.name !== RolesEnum.ADMIN
		) {
			this.hideOrg = true;
		}
	}

	async getKPI() {
		await this.goalSettingsService
			.getAllKPI({ organization: { id: this.orgId } })
			.then((kpi) => {
				const { items } = kpi;
				this.KPIs = items;
			});
	}

	async getTeams() {
		await this.organizationTeamsService
			.getAll(['members'], { organizationId: this.orgId })
			.then((res) => {
				const { items } = res;
				this.teams = items;
			});
	}

	deadlineValidators() {
		if (
			this.keyResultsForm.get('deadline').value ===
			this.keyResultDeadlineEnum.NO_CUSTOM_DEADLINE
		) {
			this.keyResultsForm.controls['softDeadline'].clearValidators();
			this.keyResultsForm.patchValue({ softDeadline: undefined });
			this.keyResultsForm.controls[
				'softDeadline'
			].updateValueAndValidity();
			this.keyResultsForm.controls['hardDeadline'].clearValidators();
			this.keyResultsForm.patchValue({ hardDeadline: undefined });
			this.keyResultsForm.controls[
				'hardDeadline'
			].updateValueAndValidity();
		} else if (
			this.keyResultsForm.get('deadline').value ===
			this.keyResultDeadlineEnum.HARD_DEADLINE
		) {
			this.keyResultsForm.controls['softDeadline'].clearValidators();
			this.keyResultsForm.patchValue({ softDeadline: undefined });
			this.keyResultsForm.controls[
				'softDeadline'
			].updateValueAndValidity();
			this.keyResultsForm.controls['hardDeadline'].setValidators([
				Validators.required
			]);
			this.keyResultsForm.controls[
				'hardDeadline'
			].updateValueAndValidity();
		} else if (
			this.keyResultsForm.get('deadline').value ===
			this.keyResultDeadlineEnum.HARD_AND_SOFT_DEADLINE
		) {
			this.keyResultsForm.controls['softDeadline'].setValidators([
				Validators.required
			]);
			this.keyResultsForm.controls[
				'softDeadline'
			].updateValueAndValidity();
			this.keyResultsForm.controls['hardDeadline'].setValidators([
				Validators.required
			]);
			this.keyResultsForm.controls[
				'hardDeadline'
			].updateValueAndValidity();
		}
	}

	selectEmployee(event, control) {
		if (control === 'lead') {
			this.keyResultsForm.patchValue({ lead: event });
		} else if (control === 'alignedGoalOwner') {
			this.keyResultsForm.patchValue({ alignedGoalOwner: event });
		} else {
			this.keyResultsForm.patchValue({ owner: event });
		}
	}

	async saveKeyResult() {
		if (this.keyResultsForm.value.type === KeyResultTypeEnum.KPI) {
			const selectedKPI = this.KPIs.find(
				(kpi) => kpi.id === this.keyResultsForm.value.kpiId
			);
			this.keyResultsForm.patchValue({
				initialValue: selectedKPI.currentValue,
				targetValue: selectedKPI.targetValue
			});
		}
		// Create objective from keyResult
		if (!!this.keyResultsForm.value.assignAsObjective) {
			const objectiveData: Goal = {
				name: this.keyResultsForm.value.name,
				description: this.keyResultsForm.value.description,
				lead: this.keyResultsForm.value.lead,
				deadline: this.goalDeadline,
				level: this.keyResultsForm.value.level,
				progress: 0,
				organizationId: this.orgId,
				alignedKeyResult: this.data
			};
			objectiveData[
				this.keyResultsForm.value.level === GoalLevelEnum.EMPLOYEE
					? 'ownerEmployee'
					: this.keyResultsForm.value.level === GoalLevelEnum.TEAM
					? 'ownerTeam'
					: 'ownerOrg'
			] = this.keyResultsForm.value.alignedGoalOwner;
			await this.goalService.createGoal(objectiveData);
		}
		// Assign Task dueDate as keyResult's hard Deadline.
		if (this.keyResultsForm.value.type === this.keyResultTypeEnum.TASK) {
			await this.taskService
				.getById(this.keyResultsForm.value.taskId)
				.then((task) => {
					if (!!task.dueDate) {
						this.keyResultsForm.patchValue({
							deadline: KeyResultDeadlineEnum.HARD_DEADLINE,
							hardDeadline: task.dueDate
						});
					}
				});
		}

		if (!!this.data) {
			// Delete all updates and progress when keyresult type is changed.
			if (this.data.type !== this.keyResultsForm.value.type) {
				this.data.progress = 0;
				this.data.update = this.keyResultsForm.value.initialValue;
				try {
					this.keyResultUpdateService.deleteBulkByKeyResultId(
						this.data.id
					);
				} catch (error) {
					console.log(error);
				}
			}
			this.keyResultsForm.patchValue({
				targetValue:
					this.keyResultsForm.value.type ===
					this.keyResultTypeEnum.TRUE_OR_FALSE
						? 1
						: this.keyResultsForm.value.type ===
						  this.keyResultTypeEnum.TASK
						? 1
						: this.keyResultsForm.value.targetValue
			});
			this.closeDialog({
				...this.keyResultsForm.value,
				update: this.data.update
					? this.data.update
					: this.keyResultsForm.value.initialValue,
				status: this.data.status ? this.data.status : 'none',
				progress: this.data.progress ? this.data.progress : 0
			});
		} else {
			this.closeDialog({
				...this.keyResultsForm.value,
				update: this.keyResultsForm.value.initialValue,
				status: 'none',
				progress: 0,
				weight: KeyResultWeightEnum.DEFAULT
			});
		}
	}

	closeDialog(data = null) {
		this.dialogRef.close(data);
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
