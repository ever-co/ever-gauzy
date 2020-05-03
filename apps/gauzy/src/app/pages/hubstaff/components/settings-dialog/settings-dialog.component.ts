import { Component, OnInit } from '@angular/core';
import { HubstaffService } from 'apps/gauzy/src/app/@core/services/hubstaff.service';
import { NbDialogRef } from '@nebular/theme';
import { Observable } from 'rxjs';
import * as moment from 'moment';
import { tap } from 'rxjs/operators';

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
			.subtract(6, 'months')
			.format('YYYY-MM-DD')
	);
	defaultRange$;
	dispayDate: any;

	constructor(
		private _hubstaffService: HubstaffService,
		public dialogRef: NbDialogRef<SettingsDialogComponent>
	) {}

	ngOnInit() {
		this.defaultRange$ = this._hubstaffService.dateRangeActivity$.pipe(
			tap(
				(displayDate) =>
					(this.dispayDate = `${moment(displayDate.start).format(
						'MMM D, YYYY'
					)} - ${moment(displayDate.end).format('MMM D, YYYY')}`)
			)
		);
	}

	getDateDisplay() {}

	onDateChange(dateRange) {
		this._hubstaffService.setActivityDateRange(dateRange);
	}
}
