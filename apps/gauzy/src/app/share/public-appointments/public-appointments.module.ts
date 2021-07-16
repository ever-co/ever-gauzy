import { NgModule } from '@angular/core';
import { ThemeModule } from '../../@theme/theme.module';
import { PublicAppointmentsComponent } from './public-appointments.component';
import { NbCardModule, NbSpinnerModule, NbButtonModule } from '@nebular/theme';
import { PublicAppointmentRoutingModule } from './public-appointment.routing.module';
import { EventTypeService } from '../../@core/services/event-type.service';
import { CreateAppointmentModule } from './create-appointment/create-appointment.module';
import { AppointmentModule } from '../../pages/employees/appointment/appointment.module';
import { TranslateModule } from '../../@shared/translate/translate.module';

@NgModule({
	imports: [
		PublicAppointmentRoutingModule,
		ThemeModule,
		NbButtonModule,
		NbSpinnerModule,
		NbCardModule,
		AppointmentModule,
		CreateAppointmentModule,
		TranslateModule
	],
	declarations: [PublicAppointmentsComponent],
	exports: [PublicAppointmentsComponent],
	providers: [EventTypeService]
})
export class PublicAppointmentsModule {}
