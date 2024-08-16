import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ROUTES, RouterModule } from '@angular/router';
import { NbCardModule, NbIconModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { PageRegistryService } from '@gauzy/ui-core/core';
import { WorkInProgressComponent } from './work-in-progress.component';
import { createRoutes } from './work-in-progress.routes';

@NgModule({
	imports: [CommonModule, RouterModule.forChild([]), NbCardModule, NbIconModule, TranslateModule.forChild()],
	declarations: [WorkInProgressComponent],
	exports: [WorkInProgressComponent],
	providers: [
		{
			provide: ROUTES,
			useFactory: (pageRouteService: PageRegistryService) => createRoutes(pageRouteService),
			deps: [PageRegistryService],
			multi: true
		}
	]
})
export class WorkInProgressModule {}
