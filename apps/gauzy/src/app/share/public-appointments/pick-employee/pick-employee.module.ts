import { HttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { ThemeModule } from '../../../@theme/theme.module';
import { PickEmployeeComponent } from './pick-employee.component';
import { PickEmployeeRoutingModule } from './pick-employee.routing.module';
import { NbCardModule, NbButtonModule, NbToastrModule } from '@nebular/theme';
import { EmployeeSelectorsModule } from '../../../@theme/components/header/selectors/employee/employee.module';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
	imports: [
		ThemeModule,
		NbToastrModule,
		NbButtonModule,
		NbCardModule,
		EmployeeSelectorsModule,
		PickEmployeeRoutingModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	declarations: [PickEmployeeComponent],
	entryComponents: [PickEmployeeComponent],
	providers: []
})
export class PickEmployeeModule {}
