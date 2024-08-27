import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ROUTES, RouterModule } from '@angular/router';
import { NbCardModule, NbIconModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { PageRouteRegistryService } from '@gauzy/ui-core/core';
import { WorkInProgressComponent } from './work-in-progress.component';
import { createWorkInProgressRoutes } from './work-in-progress.routes';

const NB_MODULES = [NbCardModule, NbIconModule];

@NgModule({
	imports: [CommonModule, RouterModule.forChild([]), ...NB_MODULES, TranslateModule.forChild()],
	declarations: [WorkInProgressComponent],
	exports: [WorkInProgressComponent],
	providers: [
		{
			provide: ROUTES,
			useFactory: (service: PageRouteRegistryService) => createWorkInProgressRoutes(service),
			deps: [PageRouteRegistryService],
			multi: true
		}
	]
})
export class WorkInProgressModule {}
