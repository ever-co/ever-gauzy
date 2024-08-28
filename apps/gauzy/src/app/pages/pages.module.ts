import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbMenuModule, NbToastrModule, NbSpinnerModule, NbIconModule } from '@nebular/theme';
import { FeatureToggleModule as NgxFeatureToggleModule } from 'ngx-feature-toggle';
import { AuthService, CommonNavModule, RoleGuard } from '@gauzy/ui-core/core';
import { MiscellaneousModule } from '@gauzy/ui-core/shared';
import { ThemeModule } from '@gauzy/ui-core/theme';
import { PagesComponent } from './pages.component';
import { PagesRoutingModule } from './pages-routing.module';

const NB_MODULES = [NbMenuModule, NbToastrModule.forRoot(), NbSpinnerModule, NbIconModule];

@NgModule({
	imports: [
		CommonModule,
		...NB_MODULES,
		NgxFeatureToggleModule,
		ThemeModule,
		PagesRoutingModule,
		MiscellaneousModule,
		CommonNavModule
	],
	declarations: [PagesComponent],
	providers: [AuthService, RoleGuard]
})
export class PagesModule {}
