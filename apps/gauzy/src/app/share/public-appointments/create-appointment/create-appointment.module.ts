import { NgModule } from '@angular/core';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { ThemeModule } from '../../../@theme/theme.module';
import { CreateAppointmentComponent } from './create-appointment.component';
import { NbCardModule, NbSpinnerModule, NbButtonModule } from '@nebular/theme';
import { AvailabilitySlotsService, EventTypeService } from '@gauzy/ui-core/core';
import { CreateAppointmentRoutingModule } from './create-appointment.routing.module';
import { AppointmentModule } from '../../../pages/employees/appointment/appointment.module';

@NgModule({
	imports: [
		ThemeModule,
		NbButtonModule,
		NbSpinnerModule,
		NbCardModule,
		CreateAppointmentRoutingModule,
		AppointmentModule,
		I18nTranslateModule.forChild()
	],
	declarations: [CreateAppointmentComponent],
	exports: [CreateAppointmentComponent],
	providers: [EventTypeService, AvailabilitySlotsService]
})
export class CreateAppointmentModule {}
