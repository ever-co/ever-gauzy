import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbInputModule,
	NbSpinnerModule,
	NbCheckboxModule
} from '@nebular/theme';
import { ManageAppointmentRoutingModule } from './manage-appointment-routing.module';
import { NgSelectModule } from '@ng-select/ng-select';
import { ManageAppointmentComponent } from './manage-appointment.component';
import { ThemeModule } from 'apps/gauzy/src/app/@theme/theme.module';
import { TimerPickerModule } from 'apps/gauzy/src/app/@shared/timer-picker/timer-picker.module';
import { SharedModule } from 'apps/gauzy/src/app/@shared/shared.module';
import { EmployeeMultiSelectModule } from 'apps/gauzy/src/app/@shared/employee/employee-multi-select/employee-multi-select.module';
import { AlertModalModule } from 'apps/gauzy/src/app/@shared/alert-modal/alert-modal.module';
import { AppointmentEmployeesService } from 'apps/gauzy/src/app/@core/services/appointment-employees.service';
import { EmployeeSchedulesModule } from '../employee-schedules/employee-schedules.module';
import { TranslateModule } from 'apps/gauzy/src/app/@shared/translate/translate.module';

@NgModule({
	imports: [
		ThemeModule,
		ManageAppointmentRoutingModule,
		NbCardModule,
		FormsModule,
		NbButtonModule,
		NbInputModule,
		AlertModalModule,
		EmployeeSchedulesModule,
		ReactiveFormsModule,
		NbIconModule,
		NbSpinnerModule,
		TimerPickerModule,
		NbCheckboxModule,
		SharedModule,
		EmployeeMultiSelectModule,
		NgSelectModule,
		TranslateModule
	],
	exports: [ManageAppointmentComponent],
	declarations: [ManageAppointmentComponent],
	providers: [AppointmentEmployeesService]
})
export class ManageAppointmentModule {}
