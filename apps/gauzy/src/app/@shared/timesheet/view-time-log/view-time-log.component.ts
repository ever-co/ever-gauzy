import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { ITimeLog, OrganizationPermissionsEnum } from '@gauzy/contracts';
import * as moment from 'moment';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { EditTimeLogModalComponent } from './../edit-time-log-modal';
import { ViewTimeLogModalComponent } from './../view-time-log-modal';
import { TimesheetService } from './../timesheet.service';
import { Store } from './../../../@core/services';
import { TimeTrackerService } from './../../time-tracker/time-tracker.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-view-time-log',
	templateUrl: './view-time-log.component.html',
	styleUrls: ['./view-time-log.component.scss']
})
export class ViewTimeLogComponent implements OnInit, OnDestroy {
	
	OrganizationPermissionsEnum = OrganizationPermissionsEnum;
	@Input() timeLogs: ITimeLog[] = [];
	@Input() callback: CallableFunction;

	constructor(
		private readonly nbDialogService: NbDialogService,
		private readonly timesheetService: TimesheetService,
		private readonly store: Store,
		private readonly timeTrackerService: TimeTrackerService,
	) {}

	ngOnInit(): void {}

	openAddByDateProject($event: MouseEvent) {
		const [ timelog ] = this.timeLogs;
		const minutes = moment().minutes();
		const stoppedAt = new Date(
			moment(timelog.startedAt).format('YYYY-MM-DD') +
				' ' +
				moment()
					.set('minutes', minutes - (minutes % 10))
					.format('HH:mm')
		);
		const startedAt = moment(stoppedAt).subtract('1', 'hour').toDate();
		this.openEdit($event, {
			startedAt,
			stoppedAt,
			projectId: timelog.projectId
		});
	}

	openEdit($event: MouseEvent, timeLog) {
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

	onDeleteConfirm(timeLog) {
		this.timesheetService.deleteLogs(timeLog.id).then((res) => {
			this.callback(res);
			this.checkTimerStatus();
		});
	}

	checkTimerStatus() {
		const { employee, tenantId } = this.store.user;
		if (employee && employee.id) {
			this.timeTrackerService.checkTimerStatus(tenantId);
		}
	}

	ngOnDestroy(): void {}
}
