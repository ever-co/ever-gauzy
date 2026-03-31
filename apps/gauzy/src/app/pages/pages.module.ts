import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbMenuModule, NbToastrModule, NbSpinnerModule, NbIconModule } from '@nebular/theme';
import { FeatureToggleModule as NgxFeatureToggleModule } from 'ngx-feature-toggle';
import { AuthService, CommonNavModule, RoleGuard } from '@gauzy/ui-core/core';
import { MiscellaneousModule } from '@gauzy/ui-core/shared';
import { ThemeModule } from '@gauzy/ui-core/theme';
import { PagesComponent } from './pages.component';
import { PagesRoutingModule } from './pages-routing.module';

@NgModule({
	imports: [
		CommonModule,
		NbMenuModule,
		NbToastrModule,
		NbSpinnerModule,
		NbIconModule,
		NgxFeatureToggleModule,
		PagesRoutingModule,
		ThemeModule,
		CommonNavModule,
		MiscellaneousModule
	],
	declarations: [PagesComponent],
	providers: [AuthService, RoleGuard]
})
export class PagesModule {}
