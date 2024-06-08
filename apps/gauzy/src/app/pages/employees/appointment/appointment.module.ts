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
import { SharedModule } from '../../../@shared/shared.module';
import { TimezoneSelectorModule } from './timezone-selector/timezone-selector.module';
import { HeaderTitleModule } from '../../../@shared/components/header-title/header-title.module';

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
		SharedModule,
		HeaderTitleModule
	],
	exports: [AppointmentComponent],
	declarations: [AppointmentComponent],
	providers: [EmployeeAppointmentService, AppointmentEmployeesService, AvailabilitySlotsService, TimeOffService]
})
export class AppointmentModule {}
