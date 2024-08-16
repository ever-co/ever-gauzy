import { NgModule } from '@angular/core';
import { RouterModule, ROUTES } from '@angular/router';
import { SharedModule } from '@gauzy/ui-core/shared';
import { PageRegistryService } from '@gauzy/ui-core/core';
import { PLUGINS } from './plugins';
import { JobLayoutComponent } from './job-layout/job-layout.component';
import { createRoutes } from './job.routes';

@NgModule({
	declarations: [JobLayoutComponent],
	imports: [SharedModule, RouterModule.forChild([]), ...PLUGINS],
	exports: [RouterModule],
	providers: [
		{
			provide: ROUTES,
			useFactory: (pageRouteService: PageRegistryService) => createRoutes(pageRouteService),
			deps: [PageRegistryService],
			multi: true
		}
	]
})
export class JobsModule {}
