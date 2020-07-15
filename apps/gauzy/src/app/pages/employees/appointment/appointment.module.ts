import { HttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { FullCalendarModule } from '@fullcalendar/angular';
import {
	NbButtonModule,
	NbCardModule,
	NbSpinnerModule,
	NbIconModule
} from '@nebular/theme';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { ThemeModule } from '../../../@theme/theme.module';
import { AppointmentRoutingModule } from './appointment-routing.module';
import { AppointmentComponent } from './appointment.component';
import { EmployeeAppointmentService } from '../../../@core/services/employee-appointment.service';
import { SharedModule } from '../../../@shared/shared.module';
import { AppointmentEmployeesService } from '../../../@core/services/appointment-employees.service';
import { AvailabilitySlotsService } from '../../../@core/services/availability-slots.service';
import { TimezoneSelectorModule } from './timezone-selector/timezone-selector.module';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

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
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		SharedModule
	],
	exports: [AppointmentComponent],
	declarations: [AppointmentComponent],
	providers: [
		EmployeeAppointmentService,
		AppointmentEmployeesService,
		AvailabilitySlotsService
	]
})
export class AppointmentModule {}
