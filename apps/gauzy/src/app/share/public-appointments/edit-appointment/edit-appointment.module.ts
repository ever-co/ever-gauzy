import { NgModule } from '@angular/core';
import { NbCardModule, NbSpinnerModule, NbButtonModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { ThemeModule } from '../../../@theme/theme.module';
import { EditAppointmentComponent } from './edit-appointment.component';
import { EditAppointmentRoutingModule } from './edit-appointment.routing.module';
import { EmployeeAppointmentService } from '@gauzy/ui-core/core';
import { ManageAppointmentModule } from '../../../pages/employees/appointment/manage-appointment/manage-appointment.module';

@NgModule({
	imports: [
		ThemeModule,
		NbButtonModule,
		NbSpinnerModule,
		NbCardModule,
		EditAppointmentRoutingModule,
		ManageAppointmentModule,
		I18nTranslateModule.forChild()
	],
	declarations: [EditAppointmentComponent],
	providers: [EmployeeAppointmentService]
})
export class EditAppointmentModule {}
