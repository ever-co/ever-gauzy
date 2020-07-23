import { Component, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import * as moment from 'moment';

export interface EmployeeSchedule {
	employeeName: string;
	slots: any;
	timezone: string;
}

@Component({
	templateUrl: './employee-schedules.component.html'
})
export class EmployeeSchedulesComponent extends TranslationBaseComponent
	implements OnInit {
	employeeSchedule: EmployeeSchedule;
	constructor(
		public dialogRef: NbDialogRef<EmployeeSchedulesComponent>,
		private translate: TranslateService
	) {
		super(translate);
	}

	ngOnInit() {
		this.employeeSchedule.slots.forEach((s) => {
			s.startTime = moment(s.startTime)
				.tz(this.employeeSchedule.timezone)
				.format('LLLL');
			s.endTime = moment(s.endTime)
				.tz(this.employeeSchedule.timezone)
				.format('LLLL');
		});
	}

	closeDialog(val) {
		this.dialogRef.close(val);
	}
}
