import { NgModule } from '@angular/core';
import { FullCalendarModule } from '@fullcalendar/angular';
import {
	NbButtonModule,
	NbCardModule,
	NbSpinnerModule,
	NbIconModule
} from '@nebular/theme';
import { ThemeModule } from '../../../@theme/theme.module';
import { AppointmentRoutingModule } from './appointment-routing.module';
import { AppointmentComponent } from './appointment.component';
import { EmployeeAppointmentService } from '../../../@core/services/employee-appointment.service';
import { SharedModule } from '../../../@shared/shared.module';
import { AppointmentEmployeesService } from '../../../@core/services/appointment-employees.service';
import { AvailabilitySlotsService } from '../../../@core/services/availability-slots.service';
import { TimezoneSelectorModule } from './timezone-selector/timezone-selector.module';
import { TimeOffService } from '../../../@core/services/time-off.service';
import { TranslateModule } from '../../../@shared/translate/translate.module';

@NgModule({
	imports: [
		FullCalendarModule,
		AppointmentRoutingModule,
		TimezoneSelectorModule,
		ThemeModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		NbSpinnerModule,
		TranslateModule,
		SharedModule
	],
	exports: [AppointmentComponent],
	declarations: [AppointmentComponent],
	providers: [
		EmployeeAppointmentService,
		AppointmentEmployeesService,
		AvailabilitySlotsService,
		TimeOffService
	]
})
export class AppointmentModule {}
