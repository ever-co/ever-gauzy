import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import {
	ITimeLog,
	PermissionsEnum,
	OrganizationPermissionsEnum
} from '@gauzy/contracts';
import { EditTimeLogModalComponent } from '../../edit-time-log-modal/edit-time-log-modal.component';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TimesheetService } from '../../timesheet.service';
import { TimeLogsLable } from 'apps/gauzy/src/app/@core/constants/timesheet.constants';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-view-time-log-modal',
	templateUrl: './view-time-log-modal.component.html',
	styleUrls: ['view-time-log-modal.component.scss']
})
export class ViewTimeLogModalComponent implements OnInit, OnDestroy {
	PermissionsEnum = PermissionsEnum;
	OrganizationPermissionsEnum = OrganizationPermissionsEnum;
	TimeLogsLable = TimeLogsLable;
	@Input() timeLog: ITimeLog;

	constructor(
		private timesheetService: TimesheetService,
		private nbDialogService: NbDialogService,
		private dialogRef: NbDialogRef<ViewTimeLogModalComponent>
	) {}

	ngOnInit(): void {}

	openDialog() {
		this.nbDialogService
			.open(EditTimeLogModalComponent, {
				context: { timeLog: this.timeLog }
			})
			.onClose.pipe(untilDestroyed(this))
			.subscribe((type) => {
				this.dialogRef.close(type);
			});
	}

	close() {
		this.dialogRef.close(null);
	}

	onDeleteConfirm() {
		this.timesheetService.deleteLogs(this.timeLog.id).then((res) => {
			this.dialogRef.close(res);
		});
	}

	ngOnDestroy(): void {}
}
