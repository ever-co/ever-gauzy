import { HttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { ThemeModule } from '../../../@theme/theme.module';
import { EmployeeSelectComponent } from './employee-multi-select.component';
import { FormsModule } from '@angular/forms';
import { SharedModule } from '../../shared.module';
import { NbSelectModule } from '@nebular/theme';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
	imports: [
		ThemeModule,
		NbSelectModule,
		FormsModule,
		SharedModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	declarations: [EmployeeSelectComponent],
	entryComponents: [EmployeeSelectComponent],
	exports: [EmployeeSelectComponent],
	providers: []
})
export class EmployeeMultiSelectModule {}
