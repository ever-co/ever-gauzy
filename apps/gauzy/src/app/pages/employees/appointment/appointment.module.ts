import { NgModule } from '@angular/core';
import { FullCalendarModule } from '@fullcalendar/angular';
import { NbButtonModule, NbCardModule, NbSpinnerModule, NbIconModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import {
	AppointmentEmployeesService,
	AvailabilitySlotsService,
	EmployeeAppointmentService,
	TimeOffService
} from '@gauzy/ui-sdk/core';
import { ThemeModule } from '../../../@theme/theme.module';
import { AppointmentRoutingModule } from './appointment-routing.module';
import { AppointmentComponent } from './appointment.component';
import { SharedModule } from '@gauzy/ui-sdk/shared';
import { TimezoneSelectorModule } from './timezone-selector/timezone-selector.module';

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
		I18nTranslateModule.forChild(),
		SharedModule
	],
	exports: [AppointmentComponent],
	declarations: [AppointmentComponent],
	providers: [EmployeeAppointmentService, AppointmentEmployeesService, AvailabilitySlotsService, TimeOffService]
})
export class AppointmentModule {}
