import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { EmployeesService } from '../../../@core/services';
import {
	KeyResult,
	KeyResultUpdates,
	KeyResultDeadlineEnum,
	RolesEnum,
	KeyResultTypeEnum,
	Task,
	TaskStatusEnum,
	KeyResultUpdateStatusEnum,
	KPI
} from '@gauzy/models';
import { KeyResultUpdateComponent } from '../keyresult-update/keyresult-update.component';
import { first, takeUntil } from 'rxjs/operators';
import { KeyResultService } from '../../../@core/services/keyresult.service';
import { Subject } from 'rxjs';
import { AlertModalComponent } from '../../../@shared/alert-modal/alert-modal.component';
import { KeyResultProgressChartComponent } from '../keyresult-progress-chart/keyresult-progress-chart.component';
import { GoalSettingsService } from '../../../@core/services/goal-settings.service';
import { isFuture, isToday, compareDesc, isPast } from 'date-fns';
import { Store } from '../../../@core/services/store.service';
import { TaskDialogComponent } from '../../tasks/components/task-dialog/task-dialog.component';
import { TasksService } from '../../../@core/services/tasks.service';
import { TasksStoreService } from '../../../@core/services/tasks-store.service';
import { OrganizationProjectsService } from '../../../@core/services/organization-projects.service';
import { KeyResultUpdateService } from '../../../@core/services/keyresult-update.service';

@Component({
	selector: 'ga-keyresult-details',
	templateUrl: './keyresult-details.component.html',
	styleUrls: ['./keyresult-details.component.scss']
})
export class KeyResultDetailsComponent implements OnInit, OnDestroy {
	src: string;
	keyResult: KeyResult;
	updates: KeyResultUpdates[];
	keyResultDeadlineEnum = KeyResultDeadlineEnum;
	isUpdatable = true;
	startDate: Date;
	today = new Date();
	loading = true;
	task: Task;
	kpi: KPI;
	endDate: Date;
	private _ngDestroy$ = new Subject<void>();
	ownerName: string;
	@ViewChild(KeyResultProgressChartComponent)
	chart: KeyResultProgressChartComponent;
	constructor(
		private dialogRef: NbDialogRef<KeyResultDetailsComponent>,
		private employeeService: EmployeesService,
		private dialogService: NbDialogService,
		private keyResultService: KeyResultService,
		private goalSettingsService: GoalSettingsService,
		private store: Store,
		private taskService: TasksService,
		private _store: TasksStoreService,
		private organizationProject: OrganizationProjectsService,
		private keyResultUpdateService: KeyResultUpdateService
	) {}

	async ngOnInit() {
		const employee = await this.employeeService.getEmployeeById(
			this.keyResult.owner.id,
			['user']
		);
		this.src = employee.user.imageUrl;
		this.ownerName = employee.user.name;
		this.updates = [...this.keyResult.updates].sort((a, b) =>
			compareDesc(new Date(a.createdAt), new Date(b.createdAt))
		);
		// prevent keyresult updates after deadline
		this.goalSettingsService
			.getTimeFrameByName(this.keyResult.goal.deadline)
			.then(async (res) => {
				const timeFrame = res.items[0];
				this.startDate = new Date(timeFrame.startDate);
				if (
					this.keyResult.deadline ===
					this.keyResultDeadlineEnum.NO_CUSTOM_DEADLINE
				) {
					this.endDate = new Date(timeFrame.endDate);
					this.isUpdatable =
						(isFuture(this.endDate) || isToday(this.endDate)) &&
						isPast(this.startDate);
				} else {
					this.endDate = new Date(this.keyResult.hardDeadline);
					this.isUpdatable =
						(isFuture(this.endDate) || isToday(this.endDate)) &&
						isPast(this.startDate);
				}
				this.store.user$
					.pipe(takeUntil(this._ngDestroy$))
					.subscribe((user) => {
						if (
							user.role.name !== RolesEnum.SUPER_ADMIN &&
							user.role.name !== RolesEnum.ADMIN &&
							user.employee.id !== this.keyResult.owner.id &&
							!!this.keyResult.lead.id
								? user.employee.id !== this.keyResult.lead.id
								: false
						) {
							this.isUpdatable = false;
						}
					});
			});
		if (this.keyResult.type === KeyResultTypeEnum.TASK) {
			await this.taskService
				.getById(this.keyResult.taskId)
				.then((task) => {
					this.task = task;
					this.organizationProject
						.getById(task.projectId)
						.then((project) => {
							this.task.project = project;
							this.loading = false;
						});
				});
		} else if (this.keyResult.type === KeyResultTypeEnum.KPI) {
			console.log(this.keyResult.kpiId);
			await this.goalSettingsService
				.getAllKPI({ id: this.keyResult.kpiId })
				.then((kpi) => {
					const { items } = kpi;
					this.kpi = items.pop();
					this.loading = false;
				});
		} else {
			this.loading = false;
		}
	}

	async loadModal() {
		await this.keyResultService
			.findKeyResult(this.keyResult.id)
			.then((keyResult) => {
				this.keyResult = keyResult.items[0];
				this.updates = [...keyResult.items[0].updates].sort(
					(a, b) =>
						new Date(b.createdAt).getTime() -
						new Date(a.createdAt).getTime()
				);
				this.chart.updateChart(this.keyResult);
			});
	}

	async keyResultUpdate() {
		if (this.keyResult.type === KeyResultTypeEnum.TASK) {
			const taskDialog = this.dialogService.open(TaskDialogComponent, {
				context: {
					selectedTask: this.task
				},
				closeOnBackdropClick: false
			});
			const taskResponse = await taskDialog.onClose
				.pipe(first())
				.toPromise();
			if (!!taskResponse) {
				const {
					estimateDays,
					estimateHours,
					estimateMinutes
				} = taskResponse;
				const estimate =
					estimateDays * 24 * 60 * 60 +
					estimateHours * 60 * 60 +
					estimateMinutes * 60;
				estimate
					? (taskResponse.estimate = estimate)
					: (taskResponse.estimate = null);
				this._store.editTask({
					...taskResponse,
					id: this.task.id
				});
				try {
					this.keyResult.update =
						taskResponse.status === TaskStatusEnum.COMPLETED
							? 1
							: 0;
					this.keyResult.progress =
						this.keyResult.update === 0 ? 0 : 100;
					this.keyResult.status =
						taskResponse.status === TaskStatusEnum.COMPLETED
							? KeyResultUpdateStatusEnum.ON_TRACK
							: KeyResultUpdateStatusEnum.NONE;
					const update: KeyResultUpdates = {
						keyResultId: this.keyResult.id,
						owner: this.keyResult.owner.id,
						update: this.keyResult.update,
						progress: this.keyResult.progress,
						status: this.keyResult.status
					};
					await this.keyResultUpdateService.createUpdate(update);
					delete this.keyResult.updates;
					await this.keyResultService
						.update(this.keyResult.id, this.keyResult)
						.then((updateRes) => {
							if (updateRes) {
								this.loadModal();
							}
						});
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
			const response = await dialog.onClose.pipe(first()).toPromise();
			if (!!response) {
				try {
					await this.keyResultService
						.update(this.keyResult.id, response)
						.then((updateRes) => {
							if (updateRes) {
								this.loadModal();
							}
						});
				} catch (error) {
					console.log(error);
				}
			}
		}
	}

	async deleteKeyResult() {
		const dialog = this.dialogService.open(AlertModalComponent, {
			context: {
				alertOptions: {
					title: 'Delete Key Result',
					message: 'Are you sure? This action is irreversible.',
					status: 'danger'
				}
			},
			closeOnBackdropClick: false
		});
		const response = await dialog.onClose.pipe(first()).toPromise();
		if (!!response) {
			if (response === 'yes') {
				await this.keyResultService
					.delete(this.keyResult.id)
					.catch((error) => console.log(error));
				this.dialogRef.close('deleted');
			}
		}
	}

	closeDialog() {
		this.dialogRef.close(this.keyResult);
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
