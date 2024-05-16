import { NgModule } from '@angular/core';
import { NbCardModule, NbSpinnerModule, NbButtonModule } from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { ThemeModule } from '../../../@theme/theme.module';
import { AppointmentModule } from '../../../pages/employees/appointment/appointment.module';
import { AppointmentFormRoutingModule } from './appointment-form.routing.module';
import { AppointmentFormComponent } from './appointment-form.component';
import { ManageAppointmentModule } from '../../../pages/employees/appointment/manage-appointment/manage-appointment.module';

@NgModule({
	imports: [
		ThemeModule,
		NbButtonModule,
		NbSpinnerModule,
		NbCardModule,
		AppointmentFormRoutingModule,
		AppointmentModule,
		ManageAppointmentModule,
		TranslateModule
	],
	declarations: [AppointmentFormComponent],
	exports: [AppointmentFormComponent],
	providers: []
})
export class AppointmentFormModule {}
