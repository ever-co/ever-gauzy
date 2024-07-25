import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbMenuModule, NbToastrModule, NbSpinnerModule, NbIconModule } from '@nebular/theme';
import { FeatureToggleModule as NgxFeatureToggleModule } from 'ngx-feature-toggle';
import { AuthService, CommonNavModule, RoleGuard } from '@gauzy/ui-core/core';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { ThemeModule } from '@gauzy/ui-core/theme';
import { MiscellaneousModule } from './miscellaneous/miscellaneous.module';
import { PagesComponent } from './pages.component';
import { PagesRoutingModule } from './pages-routing.module';

@NgModule({
	imports: [
		CommonModule,
		NbIconModule,
		NbMenuModule,
		NbSpinnerModule,
		NbToastrModule.forRoot(),
		NgxFeatureToggleModule,
		I18nTranslateModule.forChild(),
		ThemeModule,
		PagesRoutingModule,
		MiscellaneousModule,
		CommonNavModule
	],
	declarations: [PagesComponent],
	providers: [AuthService, RoleGuard]
})
export class PagesModule {}
