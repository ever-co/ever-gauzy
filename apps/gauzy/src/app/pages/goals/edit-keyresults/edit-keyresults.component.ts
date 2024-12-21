import { Component, OnInit, OnDestroy } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { UntypedFormGroup, UntypedFormBuilder, Validators, FormControl } from '@angular/forms';
import {
	EmployeesService,
	GoalService,
	GoalSettingsService,
	KeyResultUpdateService,
	OrganizationTeamsService,
	TasksService
} from '@gauzy/ui-core/core';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import {
	IEmployee,
	IKeyResult,
	KeyResultTypeEnum,
	KeyResultDeadlineEnum,
	KeyResultWeightEnum,
	GoalLevelEnum,
	IOrganizationTeam,
	RolesEnum,
	IGoal,
	IKPI,
	IGoalGeneralSetting,
	KeyResultNumberUnitsEnum,
	IOrganization
} from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { endOfTomorrow } from 'date-fns';

@Component({
    selector: 'ga-edit-keyresults',
    templateUrl: './edit-keyresults.component.html',
    styleUrls: ['./edit-keyresults.component.scss'],
    standalone: false
})
export class EditKeyResultsComponent implements OnInit, OnDestroy {
	employees: IEmployee[];
	keyResultsForm: UntypedFormGroup;
	data: IKeyResult;
	showAllEmployees = false;
	settings: IGoalGeneralSetting;
	orgId: string;
	orgName: string;
	numberUnitsEnum: string[] = Object.values(KeyResultNumberUnitsEnum);
	helperText = '';
	teams: IOrganizationTeam[] = [];
	hideOrg = false;
	hideTeam = false;
	hideEmployee = false;
	goalLevelEnum = GoalLevelEnum;
	softDeadline: FormControl;
	keyResultTypeEnum = KeyResultTypeEnum;
	goalDeadline: string;
	keyResultDeadlineEnum = KeyResultDeadlineEnum;
	minDate = endOfTomorrow();
	KPIs: Array<IKPI>;
	private _ngDestroy$ = new Subject<void>();
	organization: IOrganization;
	constructor(
		private dialogRef: NbDialogRef<EditKeyResultsComponent>,
		public fb: UntypedFormBuilder,
		private employeeService: EmployeesService,
		private taskService: TasksService,
		private organizationTeamsService: OrganizationTeamsService,
		private store: Store,
		private goalService: GoalService,
		private goalSettingsService: GoalSettingsService,
		private keyResultUpdateService: KeyResultUpdateService
	) {}

	async ngOnInit() {
		this.organization = this.store.selectedOrganization;
		this.keyResultsForm = this.fb.group({
			name: ['', Validators.required],
			description: [''],
			type: [this.keyResultTypeEnum.NUMERICAL, Validators.required],
			unit: [KeyResultNumberUnitsEnum.ITEMS],
			targetValue: [1],
			initialValue: [0],
			ownerId: [null, Validators.required],
			leadId: [null],
			deadline: [this.keyResultDeadlineEnum.NO_CUSTOM_DEADLINE, Validators.required],
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
				softDeadline: this.data.softDeadline ? new Date(this.data.softDeadline) : null,
				hardDeadline: this.data.hardDeadline ? new Date(this.data.hardDeadline) : null,
				leadId: !!this.data.lead ? this.data.lead.id : null,
				ownerId: this.data.owner.id
			});
		} else {
			await this.getKPI();
		}
		const { id: organizationId, tenantId } = this.organization;
		this.employeeService
			.getAll(['user'], { organizationId, tenantId })
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
		const { id: organizationId, tenantId } = this.organization;
		await this.goalSettingsService.getAllKPI({ organization: { id: organizationId }, tenantId }).then((kpi) => {
			const { items } = kpi;
			this.KPIs = items;
		});
	}

	async getTeams() {
		const { id: organizationId, tenantId } = this.organization;
		await this.organizationTeamsService.getAll(['members'], { organizationId, tenantId }).then((res) => {
			const { items } = res;
			this.teams = items;
		});
	}

	deadlineValidators() {
		if (this.keyResultsForm.get('deadline').value === this.keyResultDeadlineEnum.NO_CUSTOM_DEADLINE) {
			this.keyResultsForm.controls['softDeadline'].clearValidators();
			this.keyResultsForm.patchValue({ softDeadline: undefined });
			this.keyResultsForm.controls['softDeadline'].updateValueAndValidity();
			this.keyResultsForm.controls['hardDeadline'].clearValidators();
			this.keyResultsForm.patchValue({ hardDeadline: undefined });
			this.keyResultsForm.controls['hardDeadline'].updateValueAndValidity();
		} else if (this.keyResultsForm.get('deadline').value === this.keyResultDeadlineEnum.HARD_DEADLINE) {
			this.keyResultsForm.controls['softDeadline'].clearValidators();
			this.keyResultsForm.patchValue({ softDeadline: undefined });
			this.keyResultsForm.controls['softDeadline'].updateValueAndValidity();
			this.keyResultsForm.controls['hardDeadline'].setValidators([Validators.required]);
			this.keyResultsForm.controls['hardDeadline'].updateValueAndValidity();
		} else if (this.keyResultsForm.get('deadline').value === this.keyResultDeadlineEnum.HARD_AND_SOFT_DEADLINE) {
			this.keyResultsForm.controls['softDeadline'].setValidators([Validators.required]);
			this.keyResultsForm.controls['softDeadline'].updateValueAndValidity();
			this.keyResultsForm.controls['hardDeadline'].setValidators([Validators.required]);
			this.keyResultsForm.controls['hardDeadline'].updateValueAndValidity();
		}
	}

	selectEmployee(event, control) {
		if (control === 'lead') {
			this.keyResultsForm.patchValue({ leadId: event });
		} else if (control === 'alignedGoalOwner') {
			this.keyResultsForm.patchValue({ alignedGoalOwner: event });
		} else {
			this.keyResultsForm.patchValue({ ownerId: event });
		}
	}

	async saveKeyResult() {
		if (this.keyResultsForm.value.type === KeyResultTypeEnum.KPI) {
			const selectedKPI = this.KPIs.find((kpi) => kpi.id === this.keyResultsForm.value.kpiId);
			this.keyResultsForm.patchValue({
				initialValue: selectedKPI.currentValue,
				targetValue: selectedKPI.targetValue
			});
		}
		// Create objective from keyResult
		if (!!this.keyResultsForm.value.assignAsObjective) {
			const { id: organizationId, tenantId } = this.organization;
			const objectiveData: IGoal = {
				name: this.keyResultsForm.value.name,
				description: this.keyResultsForm.value.description,
				lead: this.keyResultsForm.value.lead,
				deadline: this.goalDeadline,
				level: this.keyResultsForm.value.level,
				progress: 0,
				organizationId,
				tenantId,
				alignedKeyResult: this.data
			};
			objectiveData[
				this.keyResultsForm.value.level === GoalLevelEnum.EMPLOYEE
					? 'ownerEmployee'
					: this.keyResultsForm.value.level === GoalLevelEnum.TEAM
					? 'ownerTeam'
					: 'organization'
			] = this.keyResultsForm.value.alignedGoalOwner;
			await this.goalService.createGoal(objectiveData);
		}
		// Assign Task dueDate as keyResult's hard Deadline.
		if (this.keyResultsForm.value.type === this.keyResultTypeEnum.TASK) {
			await this.taskService.getById(this.keyResultsForm.value.taskId).then((task) => {
				if (!!task.dueDate) {
					this.keyResultsForm.patchValue({
						deadline: KeyResultDeadlineEnum.HARD_DEADLINE,
						hardDeadline: task.dueDate
					});
				}
			});
		}

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		if (!!this.data) {
			// Delete all updates and progress when keyresult type is changed.
			if (this.data.type !== this.keyResultsForm.value.type) {
				this.data.progress = 0;
				this.data.update = this.keyResultsForm.value.initialValue;
				try {
					this.keyResultUpdateService.deleteBulkByKeyResultId(this.data.id);
				} catch (error) {
					console.log(error);
				}
			}
			this.keyResultsForm.patchValue({
				targetValue:
					this.keyResultsForm.value.type === this.keyResultTypeEnum.TRUE_OR_FALSE
						? 1
						: this.keyResultsForm.value.type === this.keyResultTypeEnum.TASK
						? 1
						: this.keyResultsForm.value.targetValue
			});
			this.closeDialog({
				...this.keyResultsForm.value,
				update: this.data.update ? this.data.update : this.keyResultsForm.value.initialValue,
				status: this.data.status ? this.data.status : 'none',
				progress: this.data.progress ? this.data.progress : 0,
				organizationId,
				tenantId
			});
		} else {
			this.closeDialog({
				...this.keyResultsForm.value,
				update: this.keyResultsForm.value.initialValue,
				status: 'none',
				progress: 0,
				weight: KeyResultWeightEnum.DEFAULT,
				organizationId,
				tenantId
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
