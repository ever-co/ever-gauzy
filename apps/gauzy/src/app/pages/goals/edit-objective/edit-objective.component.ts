import { Component, OnInit, OnDestroy } from '@angular/core';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import {
	Employee,
	Goal,
	GoalTimeFrame,
	GoalLevelEnum,
	TimeFrameStatusEnum
} from '@gauzy/models';
import { EmployeesService } from '../../../@core/services';
import { takeUntil, first } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { GoalSettingsService } from '../../../@core/services/goal-settings.service';
import { EditTimeFrameComponent } from '../../goal-settings/edit-time-frame/edit-time-frame.component';

@Component({
	selector: 'ga-edit-objective',
	templateUrl: './edit-objective.component.html',
	styleUrls: ['./edit-objective.component.scss']
})
export class EditObjectiveComponent implements OnInit, OnDestroy {
	objectiveForm: FormGroup;
	employees: Employee[];
	data: Goal;
	timeFrames: GoalTimeFrame[] = [];
	orgId: string;
	goalLevelEnum = GoalLevelEnum;
	timeFrameStatusEnum = TimeFrameStatusEnum;
	private _ngDestroy$ = new Subject<void>();

	constructor(
		private dialogRef: NbDialogRef<EditObjectiveComponent>,
		private fb: FormBuilder,
		private employeeService: EmployeesService,
		private goalSettingService: GoalSettingsService,
		private dialogService: NbDialogService
	) {}

	async ngOnInit() {
		this.objectiveForm = this.fb.group({
			name: ['', Validators.required],
			description: [''],
			owner: [null, Validators.required],
			lead: [null],
			level: ['', Validators.required],
			deadline: ['', Validators.required]
		});

		this.getTimeFrames();
		await this.employeeService
			.getAll(['user'])
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((employees) => {
				this.employees = employees.items;
			});
		if (!!this.data) {
			this.objectiveForm.patchValue(this.data);
			this.objectiveForm.patchValue({
				lead: !!this.data.lead ? this.data.lead.id : null,
				owner: this.data.owner.id
			});
		}
	}

	async getTimeFrames() {
		const findObj = {
			organization: {
				id: this.orgId
			}
		};
		await this.goalSettingService.getAllTimeFrames(findObj).then((res) => {
			if (res) {
				this.timeFrames = res.items.filter(
					(timeframe) =>
						timeframe.status === this.timeFrameStatusEnum.ACTIVE
				);
			}
		});
	}

	async openSetTimeFrame() {
		const dialog = this.dialogService.open(EditTimeFrameComponent, {
			context: {
				type: 'add'
			}
		});
		const response = await dialog.onClose.pipe(first()).toPromise();
		if (response) {
			await this.getTimeFrames();
		}
	}

	selectEmployee(event, control) {
		if (control === 'lead') {
			this.objectiveForm.patchValue({ lead: event });
		} else {
			this.objectiveForm.patchValue({ owner: event });
		}
	}

	saveObjective() {
		this.closeDialog(this.objectiveForm.value);
	}

	closeDialog(data = null) {
		this.dialogRef.close(data);
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
