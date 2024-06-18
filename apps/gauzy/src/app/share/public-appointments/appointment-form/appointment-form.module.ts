import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbCardModule, NbSpinnerModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { AppointmentModule } from '../../../pages/employees/appointment/appointment.module';
import { ManageAppointmentModule } from '../../../pages/employees/appointment/manage-appointment/manage-appointment.module';
import { AppointmentFormRoutingModule } from './appointment-form.routing.module';
import { AppointmentFormComponent } from './appointment-form.component';

@NgModule({
	imports: [
		CommonModule,
		NbButtonModule,
		NbCardModule,
		NbSpinnerModule,
		I18nTranslateModule.forChild(),
		AppointmentFormRoutingModule,
		AppointmentModule,
		ManageAppointmentModule
	],
	declarations: [AppointmentFormComponent],
	exports: [AppointmentFormComponent],
	providers: []
})
export class AppointmentFormModule {}
