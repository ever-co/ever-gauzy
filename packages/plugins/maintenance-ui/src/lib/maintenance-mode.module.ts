import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ROUTES } from '@angular/router';
import { NbLayoutModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { PageRouteRegistryService } from '@gauzy/ui-core/core';
import { createMaintenanceRoutes } from './maintenance-mode.routes';
import { MaintenanceModeComponent } from './maintenance-mode.component';

@NgModule({
	imports: [CommonModule, TranslateModule.forChild(), NbLayoutModule],
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
