import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import {
	TimeLog,
	PermissionsEnum,
	OrganizationPermissionsEnum
} from '@gauzy/models';
import { EditTimeLogModalComponent } from '../../edit-time-log-modal/edit-time-log-modal.component';
import { DeleteConfirmationComponent } from '../../../user/forms/delete-confirmation/delete-confirmation.component';
import { untilDestroyed } from 'ngx-take-until-destroy';
import { TimesheetService } from '../../timesheet.service';

@Component({
	selector: 'ngx-view-time-log-modal',
	templateUrl: './view-time-log-modal.component.html'
})
export class ViewTimeLogModalComponent implements OnInit, OnDestroy {
	PermissionsEnum = PermissionsEnum;
	OrganizationPermissionsEnum = OrganizationPermissionsEnum;
	@Input() timeLog: TimeLog;

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
		this.nbDialogService
			.open(DeleteConfirmationComponent)
			.onClose.pipe(untilDestroyed(this))
			.subscribe((type) => {
				if (type === 'ok') {
					this.timesheetService
						.deleteLogs(this.timeLog.id)
						.then((res) => {
							this.dialogRef.close(res);
						});
				}
			});
	}

	ngOnDestroy(): void {}
}
