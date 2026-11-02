import { NgModule } from '@angular/core';
import { ROUTES } from '@angular/router';
import { NbCardModule, NbButtonModule, NbIconModule, NbCheckboxModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { PageRouteRegistryService } from '@gauzy/ui-core/core';
import {
	DialogsModule,
	EditTimeLogModalModule,
	GauzyButtonActionModule,
	SharedModule,
	TableComponentsModule
} from '@gauzy/ui-core/shared';
import { createTimesheetDetailsRoutes } from './view.routes';
import { TimesheetViewComponent } from './view/view.component';

// Nebular Modules
const NB_MODULES = [NbButtonModule, NbCardModule, NbCheckboxModule, NbIconModule, NbTooltipModule];

@NgModule({
	declarations: [TimesheetViewComponent],
	imports: [
		...NB_MODULES,
		TranslatePipe,
		SharedModule,
		DialogsModule,
		EditTimeLogModalModule,
		GauzyButtonActionModule,
		TableComponentsModule
	],
	providers: [
		{
			provide: ROUTES,
			useFactory: (service: PageRouteRegistryService) => createTimesheetDetailsRoutes(service),
			deps: [PageRouteRegistryService],
			multi: true
		}
	]
})
export class ViewModule {}
