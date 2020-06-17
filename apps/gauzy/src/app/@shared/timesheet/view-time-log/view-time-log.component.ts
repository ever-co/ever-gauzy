import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { TimeLog, OrganizationPermissionsEnum } from '@gauzy/models';
import * as moment from 'moment';
import { NbDialogService } from '@nebular/theme';
import { EditTimeLogModalComponent } from '../edit-time-log-modal/edit-time-log-modal.component';
import { untilDestroyed } from 'ngx-take-until-destroy';
import { ViewTimeLogModalComponent } from '../view-time-log-modal/view-time-log-modal/view-time-log-modal.component';

@Component({
	selector: 'ngx-view-time-log',
	templateUrl: './view-time-log.component.html',
	styleUrls: ['./view-time-log.component.scss']
})
export class ViewTimeLogComponent implements OnInit, OnDestroy {
	OrganizationPermissionsEnum = OrganizationPermissionsEnum;
	@Input() timelogs: TimeLog[];
	@Input() callback: CallableFunction;

	constructor(private nbDialogService: NbDialogService) {}

	ngOnInit(): void {}

	openAddByDateProject($event: MouseEvent) {
		const timelog = this.timelogs[0];
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

	viewLog(timeLog: TimeLog) {
		this.nbDialogService.open(ViewTimeLogModalComponent, {
			context: {
				timeLog: timeLog
			},
			dialogClass: 'view-log-dialog'
		});
	}
	ngOnDestroy(): void {}
}
