import { NgModule } from '@angular/core';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { ThemeModule } from '../../../@theme/theme.module';
import { CreateAppointmentComponent } from './create-appointment.component';
import { NbCardModule, NbSpinnerModule, NbButtonModule } from '@nebular/theme';
import { EventTypeService } from '../../../@core/services/event-type.service';
import { CreateAppointmentRoutingModule } from './create-appointment.routing.module';
import { AppointmentModule } from '../../../pages/employees/appointment/appointment.module';
import { AvailabilitySlotsService } from '../../../@core/services/availability-slots.service';

@NgModule({
	imports: [
		ThemeModule,
		NbButtonModule,
		NbSpinnerModule,
		NbCardModule,
		CreateAppointmentRoutingModule,
		AppointmentModule,
		TranslateModule.forChild()
	],
	declarations: [CreateAppointmentComponent],
	exports: [CreateAppointmentComponent],
	providers: [EventTypeService, AvailabilitySlotsService]
})
export class CreateAppointmentModule {}
