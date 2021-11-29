import { NgModule } from '@angular/core';
import { NbMenuModule, NbToastrModule, NbSpinnerModule, NbIconModule } from '@nebular/theme';
import { FeatureToggleModule as NgxFeatureToggleModule } from 'ngx-feature-toggle';

import { ThemeModule } from '../@theme/theme.module';
import { PagesComponent } from './pages.component';
import { PagesRoutingModule } from './pages-routing.module';
import { MiscellaneousModule } from './miscellaneous/miscellaneous.module';
import { AuthService } from '../@core/services/auth.service';
import { RoleGuard } from '../@core/guards';
import { TranslateModule } from '../@shared/translate/translate.module';

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
		TranslateModule
	],
	declarations: [PagesComponent],
	providers: [AuthService, RoleGuard]
})
export class PagesModule { }
