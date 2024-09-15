import { NgModule } from '@angular/core';
import { ROUTES, RouterModule } from '@angular/router';
import { NbCardModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { PageRouteRegistryService } from '@gauzy/ui-core/core';
import { DynamicTabsModule, SharedModule } from '@gauzy/ui-core/shared';
import { TimesheetLayoutComponent } from './layout/layout.component';
import { createTimesheetRoutes } from './timesheet.routes';

@NgModule({
	imports: [RouterModule.forChild([]), NbCardModule, TranslateModule.forChild(), SharedModule, DynamicTabsModule],
	exports: [RouterModule],
	declarations: [TimesheetLayoutComponent],
	providers: [
		{
			provide: ROUTES,
			useFactory: (service: PageRouteRegistryService) => createTimesheetRoutes(service),
			deps: [PageRouteRegistryService],
			multi: true
		}
	]
})
export class TimesheetModule {}
