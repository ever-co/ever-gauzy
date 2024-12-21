// tslint:disable: nx-enforce-module-boundaries
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IGetTimeLogInput, ITimeLog, ITimesheet, TimesheetStatus, PermissionsEnum } from '@gauzy/contracts';
import { chain } from 'underscore';
import * as moment from 'moment';
import { filter, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TimesheetService } from '@gauzy/ui-core/core';
import { EditTimeLogModalComponent } from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ngx-timesheet-view',
    templateUrl: './view.component.html',
    styleUrls: ['../../daily/daily/daily.component.scss', './view.component.scss'],
    standalone: false
})
export class TimesheetViewComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	PermissionsEnum = PermissionsEnum;
	TimesheetStatus = TimesheetStatus;
	timeLogs: any;
	logs$: Subject<any> = new Subject();
	timesheet: ITimesheet;
	selectedLog = {
		data: null,
		isSelected: false
	};
	disable = true;

	constructor(
		private readonly timesheetService: TimesheetService,
		private readonly activatedRoute: ActivatedRoute,
		private readonly nbDialogService: NbDialogService,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.logs$
			.pipe(
				tap(() => this.getLogs()),
				untilDestroyed(this)
			)
			.subscribe();
		this.activatedRoute.data
			.pipe(
				tap((data) => !!data && !!data.timesheet),
				tap(({ timesheet }) => (this.timesheet = timesheet)),
				tap(() => this.logs$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	async getLogs() {
		if (!this.timesheet) {
			return;
		}
		try {
			const { organizationId, id: timesheetId } = this.timesheet;
			const request: IGetTimeLogInput = {
				timesheetId,
				organizationId
			};
			const logs: ITimeLog[] = await this.timesheetService.getTimeLogs(request, [
				'project',
				'task',
				'employee.user'
			]);
			this.timeLogs = chain(logs)
				.groupBy((log) => moment(log.startedAt).format('YYYY-MM-DD'))
				.value();
		} catch (error) {
			console.error('Error while retrieving logs', error);
		}
	}

	openEditDialog(timeLog: ITimeLog) {
		if (timeLog.isRunning) {
			return;
		}
		this.nbDialogService
			.open(EditTimeLogModalComponent, {
				context: { timeLog: timeLog }
			})
			.onClose.pipe(
				filter((data) => !!data),
				tap(() => this.logs$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	async deleteTimeLog(timeLog: ITimeLog) {
		if (timeLog.isRunning) {
			return;
		}
		try {
			const request = {
				logIds: [timeLog.id],
				organizationId: timeLog.organizationId
			};
			await this.timesheetService.deleteLogs(request);
			this.logs$.next(true);
		} catch (error) {
			console.error('Error while deleting TimeLog', error);
		}
	}

	public selectLog(isChecked: boolean, log: ITimeLog) {
		if ((this.selectedLog.data && this.selectedLog.data.id === log?.id) || !isChecked) {
			this.clearData();
		} else {
			this.disable = true;
			this.selectedLog.isSelected = this.disable;
			this.selectedLog.data = log;
		}
		console.log(isChecked, log);
	}

	public clearData() {
		this.selectedLog = {
			data: null,
			isSelected: false
		};
		this.disable = true;
	}

	ngOnDestroy() {}
}
