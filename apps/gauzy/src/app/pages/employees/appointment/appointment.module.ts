import { HttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FullCalendarModule } from '@fullcalendar/angular';
import {
	NbAlertModule,
	NbButtonModule,
	NbCardModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbSpinnerModule,
	NbTooltipModule,
	NbTreeGridModule,
	NbSelectModule,
	NbRouteTabsetModule,
	NbCheckboxModule
} from '@nebular/theme';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { ThemeModule } from '../../../@theme/theme.module';
import { AppointmentRoutingModule } from './appointment-routing.module';
import { AppointmentComponent } from './appointment.component';
import { TimerPickerModule } from '../../../@shared/timer-picker/timer-picker.module';
import { ManageAppointmentComponent } from './manage-appointment/manage-appointment.component';
import { EmployeeAppointmentService } from '../../../@core/services/employee-appointment.service';
import { EmployeeMultiSelectModule } from '../../../@shared/employee/employee-multi-select/employee-multi-select.module';
import { SharedModule } from '../../../@shared/shared.module';
import { AppointmentEmployeesService } from '../../../@core/services/appointment-employees.service';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
	imports: [
		FullCalendarModule,
		AppointmentRoutingModule,
		ThemeModule,
		NbCardModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbInputModule,
		NbDialogModule.forChild(),
		NbTreeGridModule,
		NbIconModule,
		NbTooltipModule,
		NbSpinnerModule,
		NbSelectModule,
		NbAlertModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		NbCheckboxModule,
		TimerPickerModule,
		NbSpinnerModule,
		NbRouteTabsetModule,
		EmployeeMultiSelectModule,
		SharedModule
	],
	exports: [AppointmentComponent],
	declarations: [AppointmentComponent, ManageAppointmentComponent],
	providers: [EmployeeAppointmentService, AppointmentEmployeesService]
})
export class AppointmentModule {}
