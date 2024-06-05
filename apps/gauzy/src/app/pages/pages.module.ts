import { NgModule } from '@angular/core';
import { NbMenuModule, NbToastrModule, NbSpinnerModule, NbIconModule } from '@nebular/theme';
import { FeatureToggleModule as NgxFeatureToggleModule } from 'ngx-feature-toggle';
import { AuthService, CommonNavModule, RoleGuard } from '@gauzy/ui-sdk/core';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { ThemeModule } from '../@theme/theme.module';
import { PagesComponent } from './pages.component';
import { PagesRoutingModule } from './pages-routing.module';
import { MiscellaneousModule } from './miscellaneous/miscellaneous.module';

@NgModule({
	imports: [
		PagesRoutingModule,
		NbMenuModule,
		NbToastrModule.forRoot(),
		NbSpinnerModule,
		NbIconModule,
		NgxFeatureToggleModule,
		ThemeModule,
		MiscellaneousModule,
		I18nTranslateModule.forChild(),
		CommonNavModule
	],
	declarations: [PagesComponent],
	providers: [AuthService, RoleGuard]
})
export class PagesModule {}
