import { NgModule } from '@angular/core';
import { ThemeModule } from '../../../@theme/theme.module';
import { NbCardModule, NbSpinnerModule, NbButtonModule } from '@nebular/theme';
import { AppointmentModule } from '../../../pages/employees/appointment/appointment.module';
import { AppointmentFormRoutingModule } from './appointment-form.routing.module';
import { AppointmentFormComponent } from './appointment-form.component';
import { ManageAppointmentModule } from '../../../pages/employees/appointment/manage-appointment/manage-appointment.module';
import { TranslaterModule } from '../../../@shared/translater/translater.module';

@NgModule({
	imports: [
		ThemeModule,
		NbButtonModule,
		NbSpinnerModule,
		NbCardModule,
		AppointmentFormRoutingModule,
		AppointmentModule,
		ManageAppointmentModule,
		TranslaterModule
	],
	declarations: [AppointmentFormComponent],
	entryComponents: [AppointmentFormComponent],
	exports: [AppointmentFormComponent],
	providers: []
})
export class AppointmentFormModule {}
