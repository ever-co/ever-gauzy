import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbCardModule, NbSpinnerModule } from '@nebular/theme';
import { EventTypeService } from '@gauzy/ui-core/core';
import { TranslateModule } from '@ngx-translate/core';
import { PublicAppointmentsComponent } from './public-appointments.component';
import { PublicAppointmentRoutingModule } from './public-appointment.routing.module';
import { CreateAppointmentModule } from './create-appointment/create-appointment.module';
import { AppointmentModule } from '../../pages/employees/appointment/appointment.module';

@NgModule({
	imports: [
		CommonModule,
		PublicAppointmentRoutingModule,
		NbButtonModule,
		NbCardModule,
		NbSpinnerModule,
		TranslateModule.forChild(),
		AppointmentModule,
		CreateAppointmentModule
	],
	declarations: [PublicAppointmentsComponent],
	exports: [PublicAppointmentsComponent],
	providers: [EventTypeService]
})
export class PublicAppointmentsModule {}
