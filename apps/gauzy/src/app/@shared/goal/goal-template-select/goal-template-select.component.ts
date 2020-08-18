import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { GoalTemplatesService } from '../../../@core/services/goal-templates.service';
import {
	GoalTemplate,
	GoalTimeFrame,
	TimeFrameStatusEnum,
	Employee,
	OrganizationTeam,
	GoalLevelEnum
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
		private employeeService: EmployeesService,
		private fb: FormBuilder
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
			lead: ['', Validators.required]
		});
		await this.getTimeFrames();
		this.goalTemplateService.getAllGoalTemplates().then((res) => {
			const { items } = res;
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
			await this.goalService.createGoal(goal).then((res) => {
				if (res) {
					this.closeDialog('done');
				}
			});
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
