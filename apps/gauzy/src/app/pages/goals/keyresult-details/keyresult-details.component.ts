import { Component, OnInit, OnDestroy, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { takeUntil } from 'rxjs/operators';
import { Subject, firstValueFrom } from 'rxjs';
import { isFuture, isToday, compareDesc, isPast } from 'date-fns';
import {
	EmployeesService,
	GoalSettingsService,
	KeyResultService,
	KeyResultUpdateService,
	OrganizationProjectsService,
	Store,
	TasksService,
	TasksStoreService
} from '@gauzy/ui-core/core';
import {
	IKeyResult,
	IKeyResultUpdate,
	KeyResultDeadlineEnum,
	RolesEnum,
	KeyResultTypeEnum,
	ITask,
	TaskStatusEnum,
	KeyResultUpdateStatusEnum,
	IKPI,
	IOrganization,
	IUser,
	PermissionsEnum
} from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';
import { AddTaskDialogComponent, AlertModalComponent } from '@gauzy/ui-core/shared';
import { KeyResultUpdateComponent } from '../keyresult-update/keyresult-update.component';
import { KeyResultProgressChartComponent } from '../keyresult-progress-chart/keyresult-progress-chart.component';

@Component({
	selector: 'ga-keyresult-details',
	templateUrl: './keyresult-details.component.html',
	styleUrls: ['./keyresult-details.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class KeyResultDetailsComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	src: string;
	keyResult: IKeyResult;
	updates: IKeyResultUpdate[];
	keyResultDeadlineEnum = KeyResultDeadlineEnum;
	keyResultTypeEnum = KeyResultTypeEnum;
	isUpdatable = true;
	startDate: Date;
	today = new Date();
	loading = true;
	task: ITask;
	kpi: IKPI;
	endDate: Date;
	private _ngDestroy$ = new Subject<void>();
	ownerName: string;
	@ViewChild(KeyResultProgressChartComponent)
	chart: KeyResultProgressChartComponent;
	organization: IOrganization;
	constructor(
		private dialogRef: NbDialogRef<KeyResultDetailsComponent>,
		private employeeService: EmployeesService,
		private readonly dialogService: NbDialogService,
		private keyResultService: KeyResultService,
		private goalSettingsService: GoalSettingsService,
		private store: Store,
		private taskService: TasksService,
		private _store: TasksStoreService,
		private organizationProject: OrganizationProjectsService,
		private keyResultUpdateService: KeyResultUpdateService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	async ngOnInit() {
		this.organization = this.store.selectedOrganization;
		const employee = await firstValueFrom(this.employeeService.getEmployeeById(this.keyResult.owner.id, ['user']));
		this.src = employee.user.imageUrl;
		this.ownerName = employee.user.name;
		this.updates = [...this.keyResult.updates].sort((a, b) =>
			compareDesc(new Date(a.createdAt), new Date(b.createdAt))
		);
		// prevent keyresult updates after deadline
		const findInput = {
			name: this.keyResult.goal.deadline,
			organization: {
				id: this.store.selectedOrganization.id
			},
			tenantId: this.organization.tenantId
		};
		this.goalSettingsService.getAllTimeFrames(findInput).then(async (res) => {
			const timeFrame = res.items[0];

			if (timeFrame) {
				this.startDate = new Date(timeFrame.startDate);
				if (this.keyResult.deadline === this.keyResultDeadlineEnum.NO_CUSTOM_DEADLINE) {
					this.endDate = new Date(timeFrame.endDate);
					this.isUpdatable = (isFuture(this.endDate) || isToday(this.endDate)) && isPast(this.startDate);
				} else {
					this.endDate = new Date(this.keyResult.hardDeadline);
					this.isUpdatable = (isFuture(this.endDate) || isToday(this.endDate)) && isPast(this.startDate);
				}
			}

			this.store.user$.pipe(takeUntil(this._ngDestroy$)).subscribe((user) => {
				if (!this.mayReportProgress(user)) {
					this.isUpdatable = false;
				}
			});
		});
		if (this.keyResult.type === KeyResultTypeEnum.TASK) {
			await this.taskService.getById(this.keyResult.taskId).then(async (task) => {
				this.task = task;
				const project = await firstValueFrom(this.organizationProject.getById(task.projectId));
				this.task.project = project;
				this.loading = false;
			});
		} else if (this.keyResult.type === KeyResultTypeEnum.KPI) {
			await this.goalSettingsService.getAllKPI({ id: this.keyResult.kpiId }).then((kpi) => {
				const { items } = kpi;
				this.kpi = items.pop();
				this.loading = false;
			});
		} else {
			this.loading = false;
		}
	}

	async loadModal() {
		await this.keyResultService.findKeyResult(this.keyResult.id).then((keyResult) => {
			this.keyResult = keyResult.items[0];
			this.updates = [...keyResult.items[0].updates].sort(
				(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
			);
			this.chart.updateChart(this.keyResult);
		});
	}

	/**
	 * Whether the signed-in user may report this key result's progress: the rule the server applies to a filed update
	 * (`KeyResultUpdateService.assertCallerMayReportProgress`) — a tenant administrator, a `GOALS_EDIT` holder, or the
	 * employee who owns or leads the key result. The test this replaces read `lead.id` of a key result without a lead,
	 * which threw and left the Update button on for everyone.
	 *
	 * @param user The signed-in user.
	 * @returns True when the Update button may be offered.
	 */
	mayReportProgress(user: IUser): boolean {
		const role = user?.role?.name;
		if (role === RolesEnum.SUPER_ADMIN || role === RolesEnum.ADMIN) {
			return true;
		}
		if (this.store.hasPermission(PermissionsEnum.GOALS_EDIT)) {
			return true;
		}

		const employeeId = user?.employee?.id ?? user?.employeeId;
		return !!employeeId && (employeeId === this.keyResult.owner?.id || employeeId === this.keyResult.lead?.id);
	}

	relativeProgress(currentUpdate, previousUpdate) {
		let updateDiff: number;
		let keyResultValDiff: number;
		if (this.keyResult.targetValue < this.keyResult.initialValue) {
			updateDiff = previousUpdate.update - currentUpdate.update;
			keyResultValDiff = this.keyResult.initialValue - this.keyResult.targetValue;
		} else {
			updateDiff = currentUpdate.update - previousUpdate.update;
			keyResultValDiff = this.keyResult.targetValue - this.keyResult.initialValue;
		}
		const progress = Math.round((updateDiff / keyResultValDiff) * 100);
		return {
			progressText: progress > 0 ? `+ ${progress}%` : `- ${progress * -1}%`,
			status: progress > 0 ? 'success' : 'danger',
			zero: progress === 0 ? true : false
		};
	}

	/**
	 * Reports the key result's progress.
	 *
	 * Filing the update is the whole report: the server moves the key result and its goal to it (owner decision 2(a),
	 * 2026-10-23), so the key result is re-read afterwards rather than written back with `PUT /key-results/:id`, which
	 * needs `GOALS_EDIT` and refused an employee reporting their own key result.
	 */
	async keyResultUpdate() {
		if (this.keyResult.type === KeyResultTypeEnum.TASK) {
			const taskDialog = this.dialogService.open(AddTaskDialogComponent, {
				context: {
					selectedTask: this.task
				},
				closeOnBackdropClick: false
			});
			const taskResponse = await firstValueFrom(taskDialog.onClose);
			if (!!taskResponse) {
				const { estimateDays, estimateHours, estimateMinutes } = taskResponse;
				const estimate = estimateDays * 24 * 60 * 60 + estimateHours * 60 * 60 + estimateMinutes * 60;
				estimate ? (taskResponse.estimate = estimate) : (taskResponse.estimate = null);
				this._store
					.editTask({
						...taskResponse,
						id: this.task.id
					})
					.pipe(takeUntil(this._ngDestroy$))
					.subscribe();
				try {
					this.keyResult.update = taskResponse.status === TaskStatusEnum.COMPLETED ? 1 : 0;
					this.keyResult.progress = this.keyResult.update === 0 ? 0 : 100;
					this.keyResult.status =
						taskResponse.status === TaskStatusEnum.COMPLETED
							? KeyResultUpdateStatusEnum.ON_TRACK
							: KeyResultUpdateStatusEnum.NONE;
					// The endpoint validates against `TenantOrganizationBaseDTO`, which requires the organization
					const { id: organizationId, tenantId } = this.store.selectedOrganization;
					const update: IKeyResultUpdate = {
						keyResultId: this.keyResult.id,
						owner: this.keyResult.owner.id,
						update: this.keyResult.update,
						progress: this.keyResult.progress,
						status: this.keyResult.status,
						organizationId,
						tenantId
					};
					const filed = await this.keyResultUpdateService.createUpdate(update);
					if (filed) {
						await this.loadModal();
					}
				} catch (error) {
					console.log(error);
				}
			}
		} else {
			const dialog = this.dialogService.open(KeyResultUpdateComponent, {
				hasScroll: true,
				context: {
					keyResult: this.keyResult
				},
				closeOnBackdropClick: false
			});
			const response = await firstValueFrom(dialog.onClose);
			if (!!response) {
				try {
					// The dialog filed the update, and the server applied it
					await this.loadModal();
				} catch (error) {
					console.log(error);
				}
			}
		}
	}

	async deleteKeyResult() {
		const dialog = this.dialogService.open(AlertModalComponent, {
			context: {
				data: {
					title: this.getTranslation('GOALS_PAGE.DELETE_KEY_RESULT'),
					message: this.getTranslation('GOALS_PAGE.ARE_YOU_SURE'),
					status: 'danger'
				}
			},
			closeOnBackdropClick: false
		});
		const response = await firstValueFrom(dialog.onClose);
		if (!!response) {
			if (response === 'yes') {
				await this.keyResultService.delete(this.keyResult.id).catch((error) => console.log(error));
				this.dialogRef.close('deleted');
			}
		}
	}

	closeDialog(isSaved: boolean) {
		isSaved ? this.dialogRef.close(this.keyResult) : this.dialogRef.close();
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
