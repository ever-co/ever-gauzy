import { Component, OnInit } from '@angular/core';
import { HubstaffService } from 'apps/gauzy/src/app/@core/services/hubstaff.service';
import { NbDialogRef } from '@nebular/theme';
import { Observable } from 'rxjs';
import * as moment from 'moment';

@Component({
	selector: 'ngx-settings-dialog',
	templateUrl: './settings-dialog.component.html',
	styleUrls: ['./settings-dialog.component.scss']
})
export class SettingsDialogComponent implements OnInit {
	entitiesToSync$: Observable<any> = this._hubstaffService.entitiesToSync$;
	expandOptions: boolean = false;
	maxDate: Date = new Date();
	minDate: Date = new Date(
		moment()
			.subtract(3, 'years')
			.format('YYYY-MM-DD')
	);
	defaultRange$ = this._hubstaffService.dateRangeActivity$;

	constructor(
		private _hubstaffService: HubstaffService,
		public dialogRef: NbDialogRef<SettingsDialogComponent>
	) {}

	ngOnInit() {}

	onDateChange(dateRange) {
		this._hubstaffService.setActivityDateRange(dateRange);
	}
}
