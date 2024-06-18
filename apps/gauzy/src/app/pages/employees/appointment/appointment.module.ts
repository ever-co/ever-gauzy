import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbCardModule, NbIconModule, NbSpinnerModule } from '@nebular/theme';
import { FullCalendarModule } from '@fullcalendar/angular';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import {
	AppointmentEmployeesService,
	AvailabilitySlotsService,
	EmployeeAppointmentService,
	TimeOffService
} from '@gauzy/ui-core/core';
import { SharedModule } from '@gauzy/ui-core/shared';
import { AppointmentRoutingModule } from './appointment-routing.module';
import { AppointmentComponent } from './appointment.component';
import { TimezoneSelectorModule } from './timezone-selector/timezone-selector.module';

@NgModule({
	imports: [
		CommonModule,
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbSpinnerModule,
		FullCalendarModule,
		I18nTranslateModule.forChild(),
		SharedModule,
		TimezoneSelectorModule,
		AppointmentRoutingModule
	],
	exports: [AppointmentComponent],
	declarations: [AppointmentComponent],
	providers: [EmployeeAppointmentService, AppointmentEmployeesService, AvailabilitySlotsService, TimeOffService]
})
export class AppointmentModule {}
