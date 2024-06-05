import { AfterViewInit, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { Observable } from 'rxjs';
import moment from 'moment';
import { tap } from 'rxjs/operators';
import { IDateRangeActivityFilter, IntegrationEntity } from '@gauzy/contracts';
import { HubstaffService } from '@gauzy/ui-sdk/core';

@Component({
	selector: 'ngx-hubstaff-settings-dialog',
	templateUrl: './settings-dialog.component.html',
	styleUrls: ['./settings-dialog.component.scss']
})
export class SettingsDialogComponent implements OnInit, AfterViewInit {
	entitiesToSync$: Observable<any> = this._hubstaffService.entitiesToSync$;
	expandOptions: boolean;

	maxDate: Date = new Date();
	minDate: Date = new Date(moment().subtract(6, 'months').format('YYYY-MM-DD'));

	defaultRange$: Observable<IDateRangeActivityFilter>;
	dispayDate: any;
	IntegrationEntity = IntegrationEntity;

	constructor(
		private readonly _hubstaffService: HubstaffService,
		public readonly dialogRef: NbDialogRef<SettingsDialogComponent>,
		private readonly cdRef: ChangeDetectorRef
	) {}

	ngOnInit() {
		this.defaultRange$ = this._hubstaffService.dateRangeActivity$.pipe(
			tap(() => (this.expandOptions = false)),
			tap(
				(displayDate) =>
					(this.dispayDate = `${moment(displayDate.start).format('MMM D, YYYY')} - ${moment(
						displayDate.end
					).format('MMM D, YYYY')}`)
			)
		);
	}

	ngAfterViewInit(): void {
		this.cdRef.detectChanges();
	}

	getDateDisplay() {}

	onDateChange(dateRange) {
		this._hubstaffService.setActivityDateRange(dateRange);
	}
}
