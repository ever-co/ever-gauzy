import {
	HttpLoaderFactory,
	ThemeModule
} from '../../../../@theme/theme.module';
import { NgModule } from '@angular/core';
import { NbCardModule, NbButtonModule } from '@nebular/theme';
import { EmployeeSchedulesComponent } from './employee-schedules.component';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';

@NgModule({
	imports: [
		ThemeModule,
		NbCardModule,
		NbButtonModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	exports: [EmployeeSchedulesComponent],
	declarations: [EmployeeSchedulesComponent],
	entryComponents: [EmployeeSchedulesComponent],
	providers: []
})
export class EmployeeSchedulesModule {}
