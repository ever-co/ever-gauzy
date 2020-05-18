import { HttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { ThemeModule } from '../../@theme/theme.module';
import { PublicAppointmentsComponent } from './public-appointments.component';
import { AppointmentModule } from '../../pages/employees/appointment/appointment.module';
import { NbCardModule } from '@nebular/theme';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
	imports: [
		ThemeModule,
		NbCardModule,
		AppointmentModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	declarations: [PublicAppointmentsComponent],
	entryComponents: [PublicAppointmentsComponent],
	exports: [PublicAppointmentsComponent],
	providers: []
})
export class PublicAppointmentsModule {}
