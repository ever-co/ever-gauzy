import { AfterViewInit, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { NbCalendarRange, NbDialogRef } from '@nebular/theme';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import * as moment from 'moment';
import { IDateRangeActivityFilter, IntegrationEntity } from '@gauzy/contracts';
import { HubstaffService } from '@gauzy/ui-core/core';

@Component({
    selector: 'ngx-hubstaff-settings-dialog',
    templateUrl: './settings-dialog.component.html',
    styleUrls: ['./settings-dialog.component.scss'],
    standalone: false
})
export class SettingsDialogComponent implements OnInit, AfterViewInit {
	entitiesToSync$: Observable<any> = this._hubstaffService.entitiesToSync$;
	expandOptions: boolean;
	displayDate: string;
	maxDate: Date = new Date();
	minDate: Date = new Date(moment().subtract(6, 'months').format('YYYY-MM-DD'));
	defaultRange$: Observable<IDateRangeActivityFilter>;
	IntegrationEntity = IntegrationEntity;

	constructor(
		private readonly _dialogRef: NbDialogRef<SettingsDialogComponent>,
		private readonly _cdRef: ChangeDetectorRef,
		private readonly _hubstaffService: HubstaffService
	) {}

	ngOnInit() {
		this.defaultRange$ = this._hubstaffService.dateRangeActivity$.pipe(
			tap((displayDate: IDateRangeActivityFilter) => {
				this.expandOptions = false;
				const { start, end } = displayDate;
				this.displayDate = `${moment(start).format('MMM D, YYYY')} - ${moment(end).format('MMM D, YYYY')}`;
			})
		);
	}

	ngAfterViewInit(): void {
		this._cdRef.detectChanges();
	}

	/**
	 * Closes the dialog and returns a result.
	 *
	 * @param result The data to return when closing the dialog.
	 */
	closeDialog(result?: any) {
		// Closes the dialog and passes the result back to the calling component
		this._dialogRef.close(result);
	}

	/**
	 * Handles the date range change event from the date picker.
	 * Converts the NbCalendarRange into IDateRangeActivityFilter if both start and end dates are present.
	 *
	 * @param dateRange The date range object emitted by NbCalendarRange, containing start and end dates.
	 */
	onDateChange(dateRange: NbCalendarRange<any>) {
		// Ensure both start and end dates are defined
		if (dateRange.start && dateRange.end) {
			// Construct the IDateRangeActivityFilter object
			const dateRangeActivityFilter: IDateRangeActivityFilter = {
				start: dateRange.start,
				end: dateRange.end
			};

			// Call the service to set the activity date range
			this._hubstaffService.setActivityDateRange(dateRangeActivityFilter);
		}
	}
}
