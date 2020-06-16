import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { TimeLog, PermissionsEnum } from '@gauzy/models';
import { EditTimeLogModalComponent } from '../../edit-time-log-modal/edit-time-log-modal.component';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { untilDestroyed } from 'ngx-take-until-destroy';

@Component({
	selector: 'ngx-view-time-log-modal',
	templateUrl: './view-time-log-modal.component.html',
	styleUrls: ['./view-time-log-modal.component.scss']
})
export class ViewTimeLogModalComponent implements OnInit, OnDestroy {
	@Input() timeLog: TimeLog;

	canSelectEmployee: boolean;

	constructor(
		private nbDialogService: NbDialogService,
		private store: Store,
		private dialogRef: NbDialogRef<ViewTimeLogModalComponent>
	) {}

	ngOnInit(): void {
		this.store.user$.pipe(untilDestroyed(this)).subscribe(() => {
			this.canSelectEmployee = this.store.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			);
		});
	}

	openDialog() {
		this.nbDialogService.open(EditTimeLogModalComponent, {
			context: { timeLog: this.timeLog }
		});
	}

	close() {
		this.dialogRef.close(null);
	}
	ngOnDestroy(): void {}
}
