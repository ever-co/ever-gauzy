import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterModule, ROUTES } from '@angular/router';
import { NbLayoutModule } from '@nebular/theme';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { PageRouteRegistryService } from '@gauzy/ui-core/core';
import { HttpLoaderFactory } from '@gauzy/ui-core/i18n';
import { getBrowserLanguage } from '@gauzy/ui-core/shared';
import { createMaintenanceRoutes } from './maintenance-mode.routes';
import { MaintenanceModeComponent } from './maintenance-mode.component';

@NgModule({
	imports: [
		CommonModule,
		TranslateModule.forRoot({
			defaultLanguage: getBrowserLanguage(), // Get the browser language and fall back to a default if needed
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		NbLayoutModule
	],
	declarations: [MaintenanceModeComponent],
	exports: [RouterModule],
	providers: [
		{
			provide: ROUTES,
			useFactory: (service: PageRouteRegistryService) => createMaintenanceRoutes(service),
			deps: [PageRouteRegistryService],
			multi: true
		}
	]
})
export class MaintenanceModeModule {}
