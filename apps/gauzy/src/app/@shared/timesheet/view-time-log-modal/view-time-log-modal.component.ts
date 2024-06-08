import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { filter, tap } from 'rxjs/operators';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ITimeLog, PermissionsEnum, IOrganization, TimeLogSourceEnum } from '@gauzy/contracts';
import { Store, TimeLogsLabel, TimeTrackerService } from '@gauzy/ui-sdk/common';
import { TimesheetService } from '@gauzy/ui-sdk/core';
import { EditTimeLogModalComponent } from './../edit-time-log-modal';

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
				tap((organization: IOrganization) => (this.organization = organization)),
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

	redirectToClient() {
		this.router.navigate(['/pages/contacts/view/', this.timeLog.organizationContact.id]);
	}

	ngOnDestroy(): void {}
}
