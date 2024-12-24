import { DatePipe } from '@angular/common';
import { Component } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';

@Component({
	selector: 'ga-employee-end-work',
	templateUrl: 'employee-end-work.component.html',
	styleUrls: ['employee-end-work.component.scss']
})
export class EmployeeEndWorkComponent {
	backToWork: boolean;
	endWorkValue: Date;
	startWorkValue: Date;
	employeeFullName: string;
	errorMessage: string | null = null;

	constructor(
		protected dialogRef: NbDialogRef<EmployeeEndWorkComponent>,
		private datePipe: DatePipe,
		private translate: TranslateService
	) {}

	closeDialog() {
		this.dialogRef.close();
	}
	endWork() {
		const formattedStartDate = this.datePipe.transform(this.startWorkValue, 'yyyy-MM-dd');
		const formattedEndDate = this.datePipe.transform(this.endWorkValue, 'yyyy-MM-dd');

		if (formattedEndDate && formattedStartDate && formattedEndDate < formattedStartDate) {
			this.translate
				.get('NOTES.EMPLOYEE.END_WORK.DATE_CONFLICT', { endDate: formattedEndDate, startDate: formattedStartDate })
				.subscribe((translatedMessage: string) => {
					this.errorMessage = translatedMessage;
				});
			return;
		}

		this.errorMessage = null;
		this.dialogRef.close(this.endWorkValue || new Date());
	}
}
