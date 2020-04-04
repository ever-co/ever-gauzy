import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TimesheetRoutingModule } from './timesheet-routing.module';
import { DailyComponent } from './daily/daily.component';
import {
	NbCardModule,
	NbCheckboxModule,
	NbButtonModule,
	NbSelectModule,
	NbDatepickerModule,
	NbContextMenuModule,
	NbIconModule,
	NbDialogModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '../../../@shared/shared.module';
import { FormsModule } from '@angular/forms';
import { EditTimeLogDialogComponent } from './edit-time-log-dialog/edit-time-log-dialog.component';

@NgModule({
	declarations: [DailyComponent, EditTimeLogDialogComponent],
	entryComponents: [EditTimeLogDialogComponent],
	imports: [
		CommonModule,
		TimesheetRoutingModule,
		NbCardModule,
		TranslateModule,
		NbCheckboxModule,
		NbButtonModule,
		NbSelectModule,
		SharedModule,
		NbDatepickerModule,
		FormsModule,
		NbContextMenuModule,
		NbIconModule,
		NbDialogModule
	]
})
export class TimesheetModule {}
