import { HttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { NbSelectModule } from '@nebular/theme';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { HttpLoaderFactory, ThemeModule } from '../../../@theme/theme.module';
import { UserOrganizationsSelectComponent } from './user-organizations-multi-select.component';
@NgModule({
	imports: [
		ThemeModule,
		NbSelectModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	declarations: [UserOrganizationsSelectComponent],
	entryComponents: [UserOrganizationsSelectComponent],
	exports: [UserOrganizationsSelectComponent],
	providers: []
})
export class UserOrganizationsMultiSelectModule {}
