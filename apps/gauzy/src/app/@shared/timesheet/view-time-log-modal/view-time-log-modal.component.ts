import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	ITimeLog,
	PermissionsEnum,
	IOrganization
} from '@gauzy/contracts';
import { filter, tap } from 'rxjs/operators';
import { EditTimeLogModalComponent } from './../edit-time-log-modal';
import { TimesheetService } from '../timesheet.service';
import { TimeTrackerService } from './../../time-tracker/time-tracker.service';
import { TimeLogsLabel } from './../../../@core/constants';
import { Store } from './../../../@core/services';
import { Router } from '@angular/router';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-view-time-log-modal',
	templateUrl: './view-time-log-modal.component.html',
	styleUrls: ['view-time-log-modal.component.scss']
})
export class ViewTimeLogModalComponent implements OnInit, OnDestroy {
	organization: IOrganization;
	PermissionsEnum = PermissionsEnum;
	TimeLogsLabel = TimeLogsLabel;

	@Input() timeLog: ITimeLog;

	constructor(
		private readonly timesheetService: TimesheetService,
		private readonly nbDialogService: NbDialogService,
		private readonly dialogRef: NbDialogRef<ViewTimeLogModalComponent>,
		private readonly store: Store,
		private readonly timeTrackerService: TimeTrackerService,
		private readonly router: Router
	) {}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap(
					(organization: IOrganization) =>
						(this.organization = organization)
				),
				untilDestroyed(this)
			)
			.subscribe();
	}

	openDialog() {
		if (this.timeLog.isRunning) {
			return;
		}
		this.nbDialogService
			.open(EditTimeLogModalComponent, {
				context: { timeLog: this.timeLog }
			})
			.onClose.pipe(
				tap((type) => this.dialogRef.close(type)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	close() {
		this.dialogRef.close(null);
	}

	onDeleteConfirm() {
		const { id: organizationId } = this.organization;
		const request = {
			logIds: [this.timeLog.id],
			organizationId
		};
		this.timesheetService.deleteLogs(request).then((res) => {
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

	redirectToClient() {
		this.router.navigate([
			'/pages/contacts/view/',
			this.timeLog.organizationContact.id
		]);
	}

	ngOnDestroy(): void {}
}
