import { NgModule } from '@angular/core';
import { ThemeModule } from '../../@theme/theme.module';
import { PublicAppointmentsComponent } from './public-appointments.component';
import { NbCardModule, NbSpinnerModule, NbButtonModule } from '@nebular/theme';
import { PublicAppointmentRoutingModule } from './public-appointment.routing.module';
import { EventTypeService } from '@gauzy/ui-core/core';
import { CreateAppointmentModule } from './create-appointment/create-appointment.module';
import { AppointmentModule } from '../../pages/employees/appointment/appointment.module';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';

@NgModule({
	imports: [
		PublicAppointmentRoutingModule,
		ThemeModule,
		NbButtonModule,
		NbSpinnerModule,
		NbCardModule,
		AppointmentModule,
		CreateAppointmentModule,
		I18nTranslateModule.forChild()
	],
	declarations: [PublicAppointmentsComponent],
	exports: [PublicAppointmentsComponent],
	providers: [EventTypeService]
})
export class PublicAppointmentsModule {}
