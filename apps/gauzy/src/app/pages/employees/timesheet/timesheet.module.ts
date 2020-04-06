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
import { SharedModule } from 'apps/gauzy/src/app/@shared/shared.module';
import { FormsModule } from '@angular/forms';
import { TimerPickerModule } from 'apps/gauzy/src/app/@shared/timer-picker/timer-picker.module';
import { TaskSelectModule } from 'apps/gauzy/src/app/@shared/task-select/task-select.module';
import { ProjectSelectModule } from 'apps/gauzy/src/app/@shared/project-select/project-select.module';

@NgModule({
	declarations: [DailyComponent],
	exports: [],
	entryComponents: [],
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
		NbDialogModule,
		TimerPickerModule,
		TaskSelectModule,
		ProjectSelectModule
	]
})
export class TimesheetModule {}
