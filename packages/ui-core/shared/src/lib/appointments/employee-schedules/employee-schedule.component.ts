import { Component, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import * as timezone from 'moment-timezone';

/**
 * Interface for the employee schedule
 */
export interface EmployeeSchedule {
	employeeName: string;
	slots: any;
	timezone: string;
}

@Component({
	selector: 'ga-employee-schedules',
	templateUrl: './employee-schedule.component.html'
})
export class EmployeeScheduleComponent extends TranslationBaseComponent implements OnInit {
	schedule: EmployeeSchedule;

	constructor(
		readonly translateService: TranslateService,
		public readonly dialogRef: NbDialogRef<EmployeeScheduleComponent>
	) {
		super(translateService);
	}

	ngOnInit() {
		this.schedule.slots.forEach((slot: any) => {
			slot.startTime = timezone(slot.startTime).tz(this.schedule.timezone).format('LLLL');
			slot.endTime = timezone(slot.endTime).tz(this.schedule.timezone).format('LLLL');
		});
	}

	/**
	 * Close dialog
	 *
	 * @param value
	 */
	closeDialog(value: string) {
		this.dialogRef.close(value);
	}
}
