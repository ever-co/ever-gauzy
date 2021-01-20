import { NgModule } from '@angular/core';
import { ThemeModule } from '../../../@theme/theme.module';
import {
	NbCardModule,
	NbSpinnerModule,
	NbButtonModule,
	NbIconModule
} from '@nebular/theme';
import { ConfirmAppointmentRoutingModule } from './confirm-appointment.routing.module';
import { ConfirmAppointmentComponent } from './confirm-appointment.component';
import { ManageAppointmentModule } from '../../../pages/employees/appointment/manage-appointment/manage-appointment.module';
import { EmployeesService } from '../../../@core/services';
import { EmployeeAppointmentService } from '../../../@core/services/employee-appointment.service';
import { AlertModalModule } from '../../../@shared/alert-modal/alert-modal.module';
import { TranslaterModule } from '../../../@shared/translater/translater.module';

@NgModule({
	imports: [
		ThemeModule,
		NbButtonModule,
		NbSpinnerModule,
		NbCardModule,
		AlertModalModule,
		NbButtonModule,
		NbIconModule,
		ConfirmAppointmentRoutingModule,
		ManageAppointmentModule,
		TranslaterModule
	],
	declarations: [ConfirmAppointmentComponent],
	entryComponents: [ConfirmAppointmentComponent],
	providers: [EmployeesService, EmployeeAppointmentService]
})
export class ConfirmAppointmentModule {}
