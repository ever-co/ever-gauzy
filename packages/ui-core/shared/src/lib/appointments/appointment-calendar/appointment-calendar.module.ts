import { NgModule } from '@angular/core';
import { FullCalendarModule } from '@fullcalendar/angular';
import { NbButtonModule, NbCardModule, NbIconModule, NbSpinnerModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import {
	AppointmentEmployeesService,
	AvailabilitySlotsService,
	EmployeeAppointmentService,
	TimeOffService
} from '@gauzy/ui-core/core';
import { SharedModule } from '../../shared.module';
import { AppointmentCalendarComponent } from './appointment-calendar.component';
import { TimezoneSelectorModule } from '../timezone-selector/timezone-selector.module';

const NB_MODULES = [NbButtonModule, NbCardModule, NbIconModule, NbSpinnerModule];

@NgModule({
	imports: [...NB_MODULES, FullCalendarModule, TranslateModule.forChild(), SharedModule, TimezoneSelectorModule],
	exports: [AppointmentCalendarComponent],
	declarations: [AppointmentCalendarComponent],
	providers: [EmployeeAppointmentService, AppointmentEmployeesService, AvailabilitySlotsService, TimeOffService]
})
export class AppointmentCalendarModule {}
