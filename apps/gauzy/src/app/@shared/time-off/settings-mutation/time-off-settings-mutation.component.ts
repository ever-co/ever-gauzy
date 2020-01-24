import { Component, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';

@Component({
	selector: 'ngx-time-off-settings-mutation',
	templateUrl: './time-off-settings-mutation.component.html',
	styleUrls: ['./time-off-settings-mutation.component.scss']
})
export class TimeOffSettingsMutationComponent implements OnInit {
	constructor(
		protected dialogRef: NbDialogRef<TimeOffSettingsMutationComponent>
	) {}

	ngOnInit() {}

	close() {
		this.dialogRef.close();
	}
}
