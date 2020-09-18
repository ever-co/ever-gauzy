import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnInit
} from '@angular/core';
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
export class SettingsDialogComponent implements OnInit, AfterViewInit {
	entitiesToSync$: Observable<any> = this._hubstaffService.entitiesToSync$;
	expandOptions: boolean;
	maxDate: Date = new Date();
	minDate: Date = new Date(
		moment().subtract(6, 'months').format('YYYY-MM-DD')
	);
	defaultRange$;
	dispayDate: any;

	constructor(
		private _hubstaffService: HubstaffService,
		public dialogRef: NbDialogRef<SettingsDialogComponent>,
		private cdRef: ChangeDetectorRef
	) {}

	ngOnInit() {
		this.defaultRange$ = this._hubstaffService.dateRangeActivity$.pipe(
			tap(() => (this.expandOptions = false)),
			tap(
				(displayDate) =>
					(this.dispayDate = `${moment(displayDate.start).format(
						'MMM D, YYYY'
					)} - ${moment(displayDate.end).format('MMM D, YYYY')}`)
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
