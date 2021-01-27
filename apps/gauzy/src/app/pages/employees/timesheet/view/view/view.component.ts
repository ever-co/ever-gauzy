// tslint:disable: nx-enforce-module-boundaries
import { Component, OnInit, OnDestroy } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { debounceTime } from 'rxjs/operators';
import {
	IGetTimeLogInput,
	ITimeLog,
	ITimesheet,
	TimesheetStatus,
	OrganizationPermissionsEnum,
	PermissionsEnum
} from '@gauzy/contracts';
import * as _ from 'underscore';
import * as moment from 'moment';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { TimesheetService } from 'apps/gauzy/src/app/@shared/timesheet/timesheet.service';
import { NbDialogService } from '@nebular/theme';
import { EditTimeLogModalComponent } from 'apps/gauzy/src/app/@shared/timesheet/edit-time-log-modal/edit-time-log-modal.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-view',
	templateUrl: './view.component.html'
})
export class ViewComponent implements OnInit, OnDestroy {
	logRequest: {
		timesheetId?: string;
	} = {};

	OrganizationPermissionsEnum = OrganizationPermissionsEnum;
	PermissionsEnum = PermissionsEnum;
	TimesheetStatus = TimesheetStatus;
	timeLogs: any;
	updateLogs$: Subject<any> = new Subject();
	timesheet: ITimesheet;

	constructor(
		private timesheetService: TimesheetService,
		private activatedRoute: ActivatedRoute,
		private nbDialogService: NbDialogService
	) {}

	ngOnInit() {
		this.updateLogs$
			.pipe(untilDestroyed(this), debounceTime(500))
			.subscribe(() => {
				this.getLogs();
			});

		this.activatedRoute.params
			.pipe(untilDestroyed(this))
			.subscribe((params) => {
				if (params) {
					this.logRequest.timesheetId = params.id;
					this.updateLogs$.next();
				}
			});
	}

	async getLogs() {
		const request: IGetTimeLogInput = {
			timesheetId: this.logRequest.timesheetId
		};

		this.timesheetService
			.getTimeSheet(this.logRequest.timesheetId)
			.then((timesheet: ITimesheet) => {
				this.timesheet = timesheet;
			});

		this.timesheetService.getTimeLogs(request).then((logs: ITimeLog[]) => {
			this.timeLogs = _.chain(logs)
				.groupBy((log) => moment(log.startedAt).format('YYYY-MM-DD'))
				.value();
		});
	}

	openEditDialog(timeLog) {
		this.nbDialogService
			.open(EditTimeLogModalComponent, {
				context: { timeLog: timeLog }
			})
			.onClose.pipe(untilDestroyed(this))
			.subscribe((resp) => {
				if (resp) {
					this.updateLogs$.next();
				}
			});
	}

	deleteTimeLog(log) {
		this.timesheetService.deleteLogs([log.id]).then(() => {
			this.updateLogs$.next();
		});
	}
	ngOnDestroy() {}
}
