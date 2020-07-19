import { NgModule } from '@angular/core';
import { NbMenuModule, NbToastrModule, NbSpinnerModule } from '@nebular/theme';
import { ThemeModule } from '../@theme/theme.module';
import { ShareComponent } from './share.component';
import { ShareRoutingModule } from './share-routing.module';
import { MiscellaneousModule } from '../pages/miscellaneous/miscellaneous.module';
import { AuthService } from '../@core/services/auth.service';
import { RoleGuard } from '../@core/role/role.guard';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { HttpClient } from '@angular/common/http';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
	imports: [
		ShareRoutingModule,
		ThemeModule,
		NbMenuModule,
		MiscellaneousModule,
		NbToastrModule.forRoot(),
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		NbSpinnerModule
	],
	entryComponents: [],
	declarations: [ShareComponent],
	providers: [AuthService, RoleGuard]
})
export class ShareModule {}
