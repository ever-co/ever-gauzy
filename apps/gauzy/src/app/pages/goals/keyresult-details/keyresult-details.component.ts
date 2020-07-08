import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { EmployeesService } from '../../../@core/services';
import {
	KeyResult,
	KeyResultUpdates,
	KeyResultDeadlineEnum,
	RolesEnum
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

@Component({
	selector: 'ga-keyresult-details',
	templateUrl: './keyresult-details.component.html',
	styleUrls: ['./keyresult-details.component.scss']
})
export class KeyResultDetailsComponent implements OnInit, OnDestroy {
	owner: string;
	src: string;
	keyResult: KeyResult;
	updates: KeyResultUpdates[];
	keyResultDeadlineEnum = KeyResultDeadlineEnum;
	isUpdatable = true;
	startDate: Date;
	today = new Date();
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
		private store: Store
	) {}

	async ngOnInit() {
		const employee = await this.employeeService.getEmployeeById(
			this.owner,
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
			.then((res) => {
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
							user.id !== this.keyResult.owner.id &&
							user.id !== this.keyResult.lead?.id
						) {
							this.isUpdatable = false;
						}
					});
			});
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
		const dialog = this.dialogService.open(KeyResultUpdateComponent, {
			hasScroll: true,
			context: {
				keyResult: this.keyResult
			}
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

	async deleteKeyResult() {
		const dialog = this.dialogService.open(AlertModalComponent, {
			context: {
				alertOptions: {
					title: 'Delete Key Result',
					message: 'Are you sure? This action is irreversible.',
					status: 'danger'
				}
			}
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
