import { Component, OnInit } from '@angular/core';
import { HubstaffService } from 'apps/gauzy/src/app/@core/services/hubstaff.service';
import { NbDialogRef } from '@nebular/theme';
import { IIntegrationEntitySetting } from '@gauzy/models';
import { Observable } from 'rxjs';

@Component({
	selector: 'ngx-settings-dialog',
	templateUrl: './settings-dialog.component.html',
	styleUrls: ['./settings-dialog.component.scss']
})
export class SettingsDialogComponent implements OnInit {
	entitiesToSync$: Observable<any> = this._hubstaffService.entitiesToSync$;

	constructor(
		private _hubstaffService: HubstaffService,
		public dialogRef: NbDialogRef<SettingsDialogComponent>
	) {}

	ngOnInit() {}

	saveSettings() {
		this.dialogRef.close(true);
	}
}
