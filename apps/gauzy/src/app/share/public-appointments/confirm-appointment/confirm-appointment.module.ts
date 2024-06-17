import { NgModule } from '@angular/core';
import { NbCardModule, NbSpinnerModule, NbButtonModule, NbIconModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { EmployeeAppointmentService, EmployeesService } from '@gauzy/ui-core/core';
import { ConfirmAppointmentRoutingModule } from './confirm-appointment.routing.module';
import { ConfirmAppointmentComponent } from './confirm-appointment.component';
import { ManageAppointmentModule } from '../../../pages/employees/appointment/manage-appointment/manage-appointment.module';
import { SharedModule } from '@gauzy/ui-core/shared';

@NgModule({
	imports: [
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbSpinnerModule,
		I18nTranslateModule.forChild(),
		SharedModule,
		ConfirmAppointmentRoutingModule,
		ManageAppointmentModule
	],
	declarations: [ConfirmAppointmentComponent],
	providers: [EmployeesService, EmployeeAppointmentService]
})
export class ConfirmAppointmentModule {}
