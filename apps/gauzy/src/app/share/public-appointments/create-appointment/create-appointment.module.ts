import { NgModule } from '@angular/core';
import { ThemeModule } from '../../../@theme/theme.module';
import { CreateAppointmentComponent } from './create-appointment.component';
import { NbCardModule, NbSpinnerModule, NbButtonModule } from '@nebular/theme';
import { EventTypeService } from '../../../@core/services/event-type.service';
import { CreateAppointmentRoutingModule } from './create-appointment.routing.module';
import { AppointmentModule } from '../../../pages/employees/appointment/appointment.module';
import { AvailabilitySlotsService } from '../../../@core/services/availability-slots.service';
import { TranslateModule } from '../../../@shared/translate/translate.module';

@NgModule({
	imports: [
		ThemeModule,
		NbButtonModule,
		NbSpinnerModule,
		NbCardModule,
		CreateAppointmentRoutingModule,
		AppointmentModule,
		TranslateModule
	],
	declarations: [CreateAppointmentComponent],
	exports: [CreateAppointmentComponent],
	providers: [EventTypeService, AvailabilitySlotsService]
})
export class CreateAppointmentModule {}
