import { HttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { HttpLoaderFactory, ThemeModule } from '../../../@theme/theme.module';
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
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	declarations: [CreateAppointmentComponent],
	entryComponents: [CreateAppointmentComponent],
	exports: [CreateAppointmentComponent],
	providers: [EventTypeService, AvailabilitySlotsService]
})
export class CreateAppointmentModule {}
