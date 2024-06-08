import { NgModule } from '@angular/core';
import { NbCardModule, NbSpinnerModule, NbButtonModule, NbIconModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { ThemeModule } from '../../../@theme/theme.module';
import { ConfirmAppointmentRoutingModule } from './confirm-appointment.routing.module';
import { ConfirmAppointmentComponent } from './confirm-appointment.component';
import { ManageAppointmentModule } from '../../../pages/employees/appointment/manage-appointment/manage-appointment.module';
import { EmployeeAppointmentService, EmployeesService } from '@gauzy/ui-sdk/core';
import { AlertModalModule } from '../../../@shared/alert-modal/alert-modal.module';

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
		I18nTranslateModule.forChild()
	],
	declarations: [ConfirmAppointmentComponent],
	providers: [EmployeesService, EmployeeAppointmentService]
})
export class ConfirmAppointmentModule {}
