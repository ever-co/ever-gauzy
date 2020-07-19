import { HttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { ThemeModule } from '../../@theme/theme.module';
import { PublicAppointmentsComponent } from './public-appointments.component';
import { NbCardModule, NbSpinnerModule, NbButtonModule } from '@nebular/theme';
import { PublicAppointmentRoutingModule } from './public-appointment.routing.module';
import { EventTypeService } from '../../@core/services/event-type.service';
import { CreateAppointmentModule } from './create-appointment/create-appointment.module';
import { AppointmentModule } from '../../pages/employees/appointment/appointment.module';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
	imports: [
		PublicAppointmentRoutingModule,
		ThemeModule,
		NbButtonModule,
		NbSpinnerModule,
		NbCardModule,
		AppointmentModule,
		CreateAppointmentModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient],
			},
		}),
	],
	declarations: [PublicAppointmentsComponent],
	entryComponents: [PublicAppointmentsComponent],
	exports: [PublicAppointmentsComponent],
	providers: [EventTypeService],
})
export class PublicAppointmentsModule {}
