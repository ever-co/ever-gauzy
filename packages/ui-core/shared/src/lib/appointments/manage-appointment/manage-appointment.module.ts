import { NgModule } from '@angular/core';
import {
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbIconModule,
	NbInputModule,
	NbSpinnerModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '../../shared.module';
import { ManageAppointmentComponent } from './manage-appointment.component';
import { EmployeeScheduleModule } from '../employee-schedules/employee-schedule.module';
import { TimerPickerModule } from '../../timer-picker/timer-picker.module';
import { EmployeeMultiSelectModule } from '../../employee/employee-multi-select/employee-multi-select.module';

@NgModule({
	imports: [
		NbButtonModule,
		NbCardModule,
		NbCheckboxModule,
		NbIconModule,
		NbInputModule,
		NbSpinnerModule,
		NgSelectModule,
		TranslateModule.forChild(),
		SharedModule,
		EmployeeScheduleModule,
		TimerPickerModule,
		EmployeeMultiSelectModule
	],
	exports: [ManageAppointmentComponent],
	declarations: [ManageAppointmentComponent]
})
export class ManageAppointmentModule {}
