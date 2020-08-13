import { NgModule } from '@angular/core';
import { ThemeModule } from '../../@theme/theme.module';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbListModule,
	NbUserModule,
	NbTabsetModule
} from '@nebular/theme';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { EmployeeRoutingModule } from './employee-routing.module';
import { ImageUploaderModule } from '../../@shared/image-uploader/image-uploader.module';
import { EmployeeComponent } from './employee.component';
import { PublicPageEmployeeMutationModule } from '../../@shared/employee/public-page-employee-mutation/public-page-employee-mutation.module';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
	imports: [
		ThemeModule,
		EmployeeRoutingModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		NbInputModule,
		ImageUploaderModule,
		PublicPageEmployeeMutationModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		NbListModule,
		NbUserModule,
		NbTabsetModule
	],
	declarations: [EmployeeComponent],
	entryComponents: [],
	providers: []
})
export class EmployeeModule {}
