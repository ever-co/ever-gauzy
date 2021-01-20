import { NgModule } from '@angular/core';
import { NbMenuModule, NbToastrModule, NbSpinnerModule } from '@nebular/theme';
import { ThemeModule } from '../@theme/theme.module';
import { PagesComponent } from './pages.component';
import { PagesRoutingModule } from './pages-routing.module';
import { MiscellaneousModule } from './miscellaneous/miscellaneous.module';
import { AuthService } from '../@core/services/auth.service';
import { RoleGuard } from '../@core/role/role.guard';
import { FeatureToggleModule as NgxFeatureToggleModule } from 'ngx-feature-toggle';
import { TranslaterModule } from '../@shared/translater/translater.module';

@NgModule({
	imports: [
		PagesRoutingModule,
		ThemeModule,
		NbMenuModule,
		MiscellaneousModule,
		NbToastrModule.forRoot(),
		TranslaterModule,
		NbSpinnerModule,
		NgxFeatureToggleModule
	],
	entryComponents: [],
	declarations: [PagesComponent],
	providers: [AuthService, RoleGuard]
})
export class PagesModule {}
