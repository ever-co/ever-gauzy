import { Component, OnInit, Input, OnDestroy, Output } from '@angular/core';
import { IOrganization, ITimeLog, PermissionsEnum, TimeLogSourceEnum } from '@gauzy/contracts';
import * as moment from 'moment';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs/operators';
import { Store, TimeTrackerService, TimesheetService } from '@gauzy/ui-core/core';
import { EditTimeLogModalComponent } from './../edit-time-log-modal';
import { ViewTimeLogModalComponent } from './../view-time-log-modal';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ngx-view-time-log',
    templateUrl: './view-time-log.component.html',
    styleUrls: ['./view-time-log.component.scss'],
    standalone: false
})
export class ViewTimeLogComponent implements OnInit, OnDestroy {
	organization: IOrganization;
	PermissionsEnum = PermissionsEnum;
	@Input() timeLogs: ITimeLog[] = [];
	@Input() callback: CallableFunction;
	@Output() close: CallableFunction;

	constructor(
		private readonly nbDialogService: NbDialogService,
		private readonly timesheetService: TimesheetService,
		private readonly store: Store,
		private readonly timeTrackerService: TimeTrackerService
	) {}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	openAddByDateProject($event: MouseEvent) {
		const [timeLog] = this.timeLogs;
		const minutes = moment().minutes();
		const stoppedAt = new Date(
			moment(timeLog.startedAt).format('YYYY-MM-DD') +
				' ' +
				moment()
					.set('minutes', minutes - (minutes % 10))
					.format('HH:mm')
		);
		const startedAt = moment(stoppedAt).subtract('1', 'hour').toDate();
		this.openEdit($event, {
			startedAt,
			stoppedAt,
			projectId: timeLog.projectId,
			isRunning: timeLog.isRunning
		});
	}

	openEdit(
		$event: MouseEvent,
		timeLog: {
			startedAt: Date;
			stoppedAt: Date;
			projectId: string;
			isRunning: boolean;
		}
	) {
		if (timeLog.isRunning) {
			return;
		}
		$event.stopPropagation();
		this.nbDialogService
			.open(EditTimeLogModalComponent, { context: { timeLog: timeLog } })
			.onClose.pipe(untilDestroyed(this))
			.subscribe((data) => {
				this.callback(data);
			});
	}

	viewLog(timeLog: ITimeLog) {
		this.nbDialogService
			.open(ViewTimeLogModalComponent, {
				context: {
					timeLog: timeLog
				},
				dialogClass: 'view-log-dialog'
			})
			.onClose.pipe(untilDestroyed(this))
			.subscribe((res) => {
				this.callback(res);
			});
	}

	onDeleteConfirm(timeLog: ITimeLog) {
		if (timeLog.isRunning) {
			return;
		}
		const { id: organizationId } = this.organization;
		const request = {
			logIds: [timeLog.id],
			organizationId
		};
		this.timesheetService.deleteLogs(request).then((res) => {
			this.callback(res);
			this.checkTimerStatus();
		});
	}

	async checkTimerStatus() {
		if (!this.organization) {
			return;
		}
		const { employeeId, tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		if (employeeId) {
			await this.timeTrackerService.checkTimerStatus({
				organizationId,
				tenantId,
				source: TimeLogSourceEnum.WEB_TIMER
			});
		}
	}

	onClose() {
		this.close(true);
	}

	ngOnDestroy(): void {}
}
