import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbCardModule, NbSpinnerModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { AvailabilitySlotsService, EventTypeService } from '@gauzy/ui-core/core';
import { CreateAppointmentComponent } from './create-appointment.component';
import { CreateAppointmentRoutingModule } from './create-appointment.routing.module';
import { AppointmentModule } from '../../../pages/employees/appointment/appointment.module';

@NgModule({
	imports: [
		CommonModule,
		NbButtonModule,
		NbCardModule,
		NbSpinnerModule,
		I18nTranslateModule.forChild(),
		CreateAppointmentRoutingModule,
		AppointmentModule
	],
	declarations: [CreateAppointmentComponent],
	exports: [CreateAppointmentComponent],
	providers: [EventTypeService, AvailabilitySlotsService]
})
export class CreateAppointmentModule {}
