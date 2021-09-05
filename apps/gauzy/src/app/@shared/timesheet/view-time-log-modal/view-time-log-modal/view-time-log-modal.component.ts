import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	ITimeLog,
	PermissionsEnum,
	OrganizationPermissionsEnum
} from '@gauzy/contracts';
import { EditTimeLogModalComponent } from './../../edit-time-log-modal';
import { TimesheetService } from '../../timesheet.service';
import { TimeTrackerService } from './../../../time-tracker/time-tracker.service';
import { TimeLogsLabel } from './../../../../@core/constants';
import { Store } from './../../../../@core/services';
import { tap } from 'rxjs/operators';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-view-time-log-modal',
	templateUrl: './view-time-log-modal.component.html',
	styleUrls: ['view-time-log-modal.component.scss']
})
export class ViewTimeLogModalComponent implements OnInit, OnDestroy {
	
	PermissionsEnum = PermissionsEnum;
	OrganizationPermissionsEnum = OrganizationPermissionsEnum;
	TimeLogsLabel = TimeLogsLabel;
	
	@Input() timeLog: ITimeLog;

	constructor(
		private readonly timesheetService: TimesheetService,
		private readonly nbDialogService: NbDialogService,
		private readonly dialogRef: NbDialogRef<ViewTimeLogModalComponent>,
		private readonly store: Store,
		private readonly timeTrackerService: TimeTrackerService,
	) {}

	ngOnInit(): void {}

	openDialog() {
		this.nbDialogService
			.open(EditTimeLogModalComponent, {
				context: { timeLog: this.timeLog }
			})
			.onClose
			.pipe(
				tap((type) => this.dialogRef.close(type)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	close() {
		this.dialogRef.close(null);
	}

	onDeleteConfirm() {
		this.timesheetService.deleteLogs(this.timeLog.id).then((res) => {
			this.dialogRef.close(res);
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
