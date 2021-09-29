// tslint:disable: nx-enforce-module-boundaries
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
	NbCardModule,
	NbCheckboxModule,
	NbButtonModule,
	NbSelectModule,
	NbDatepickerModule,
	NbContextMenuModule,
	NbIconModule,
	NbDialogModule,
	NbSpinnerModule,
	NbPopoverModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { DailyRoutingModule } from './daily-routing.module';
import { DailyComponent } from './daily/daily.component';
import { SharedModule } from './../../../../@shared/shared.module';
import { TimerPickerModule } from './../../../../@shared/timer-picker/timer-picker.module';
import { ProjectSelectModule } from './../../../../@shared/project-select/project-select.module';
import { EmployeeSelectorsModule } from './../../../../@theme/components/header/selectors/employee/employee.module';
import { EditTimeLogModalModule } from './../../../../@shared/timesheet/edit-time-log-modal/edit-time-log-modal.module';
import { FiltersModule } from './../../../../@shared/timesheet/filters/filters.module';
import { ViewTimeLogModule } from './../../../../@shared/timesheet/view-time-log/view-time-log.module';
import { ViewTimeLogModalModule } from './../../../../@shared/timesheet/view-time-log-modal/view-time-log-modal.module';
import { TaskSelectModule } from './../../../../@shared/tasks/task-select/task-select.module';
import { DialogsModule } from './../../../../@shared/dialogs';

@NgModule({
	declarations: [DailyComponent],
	imports: [
		CommonModule,
		FormsModule,
		DailyRoutingModule,
		NbButtonModule,
		NbCardModule,
		NbCheckboxModule,
		NbContextMenuModule,
		NbDatepickerModule,
		NbDialogModule,		
		NbIconModule,
		NbPopoverModule,
		NbSelectModule,
		NbSpinnerModule,
		NbTooltipModule,
		TranslateModule,
		SharedModule,		
		TimerPickerModule,
		TaskSelectModule,
		ProjectSelectModule,
		EditTimeLogModalModule,
		ViewTimeLogModalModule,
		EmployeeSelectorsModule,
		FiltersModule,
		ViewTimeLogModule,
		DialogsModule
	]
})
export class DailyModule {}
