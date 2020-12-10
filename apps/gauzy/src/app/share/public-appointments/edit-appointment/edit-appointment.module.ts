import { HttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { HttpLoaderFactory, ThemeModule } from '../../../@theme/theme.module';
import { EditAppointmentComponent } from './edit-appointment.component';
import { EditAppointmentRoutingModule } from './edit-appointment.routing.module';
import { NbCardModule, NbSpinnerModule, NbButtonModule } from '@nebular/theme';
import { EmployeeAppointmentService } from '../../../@core/services/employee-appointment.service';
import { ManageAppointmentModule } from '../../../pages/employees/appointment/manage-appointment/manage-appointment.module';
@NgModule({
	imports: [
		ThemeModule,
		NbButtonModule,
		NbSpinnerModule,
		NbCardModule,
		EditAppointmentRoutingModule,
		ManageAppointmentModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	declarations: [EditAppointmentComponent],
	entryComponents: [EditAppointmentComponent],
	providers: [EmployeeAppointmentService]
})
export class EditAppointmentModule {}
