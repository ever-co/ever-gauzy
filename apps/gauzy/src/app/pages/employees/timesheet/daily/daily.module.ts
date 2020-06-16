// tslint:disable: nx-enforce-module-boundaries
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DailyRoutingModule } from './daily-routing.module';
import {
	NbCardModule,
	NbCheckboxModule,
	NbButtonModule,
	NbSelectModule,
	NbDatepickerModule,
	NbContextMenuModule,
	NbIconModule,
	NbDialogModule,
	NbSpinnerModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from 'apps/gauzy/src/app/@shared/shared.module';
import { FormsModule } from '@angular/forms';
import { TimerPickerModule } from 'apps/gauzy/src/app/@shared/timer-picker/timer-picker.module';
import { TaskSelectModule } from 'apps/gauzy/src/app/@shared/task-select/task-select.module';
import { ProjectSelectModule } from 'apps/gauzy/src/app/@shared/project-select/project-select.module';
import { EmployeeSelectorsModule } from 'apps/gauzy/src/app/@theme/components/header/selectors/employee/employee.module';
import { DailyComponent } from './daily/daily.component';
import { EditTimeLogModalModule } from 'apps/gauzy/src/app/@shared/timesheet/edit-time-log-modal/edit-time-log-modal.module';
import { FiltersModule } from 'apps/gauzy/src/app/@shared/timesheet/filters/filters.module';

@NgModule({
	declarations: [DailyComponent],
	imports: [
		CommonModule,
		DailyRoutingModule,
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
		ProjectSelectModule,
		EditTimeLogModalModule,
		NbIconModule,
		EmployeeSelectorsModule,
		FiltersModule,
		NbSpinnerModule
	]
})
export class DailyModule {}
