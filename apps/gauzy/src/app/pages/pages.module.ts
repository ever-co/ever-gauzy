import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ROUTES, RouterModule } from '@angular/router';
import { NbMenuModule, NbToastrModule, NbSpinnerModule, NbIconModule } from '@nebular/theme';
import { FeatureToggleModule as NgxFeatureToggleModule } from 'ngx-feature-toggle';
import { AuthService, CommonNavModule, PageRouteRegistryService, RoleGuard } from '@gauzy/ui-core/core';
import { MiscellaneousModule } from '@gauzy/ui-core/shared';
import { ThemeModule } from '@gauzy/ui-core/theme';
import { PagesComponent } from './pages.component';
import { getPagesRoutes } from './pages.routes';

@NgModule({
	imports: [
		CommonModule,
		RouterModule.forChild([]),
		NbMenuModule,
		NbToastrModule.forRoot(),
		NbSpinnerModule,
		NbIconModule,
		NgxFeatureToggleModule,
		ThemeModule,
		CommonNavModule,
		MiscellaneousModule
	],
	declarations: [PagesComponent],
	providers: [
		AuthService,
		RoleGuard,
		{
			provide: ROUTES,
			useFactory: (pageRouteRegistryService: PageRouteRegistryService) =>
				getPagesRoutes(pageRouteRegistryService),
			deps: [PageRouteRegistryService],
			multi: true
		}
	]
})
export class PagesModule {}
