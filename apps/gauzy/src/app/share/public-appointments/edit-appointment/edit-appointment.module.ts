import { NgModule } from '@angular/core';
import { NbCardModule, NbSpinnerModule, NbButtonModule } from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { ThemeModule } from '../../../@theme/theme.module';
import { EditAppointmentComponent } from './edit-appointment.component';
import { EditAppointmentRoutingModule } from './edit-appointment.routing.module';
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
		TranslateModule
	],
	declarations: [EditAppointmentComponent],
	providers: [EmployeeAppointmentService]
})
export class EditAppointmentModule {}
