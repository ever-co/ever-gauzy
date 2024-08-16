import { NgModule } from '@angular/core';
import { RouterModule, ROUTES } from '@angular/router';
import { SharedModule } from '@gauzy/ui-core/shared';
import { PageRouteRegistryService } from '@gauzy/ui-core/core';
import { PLUGINS } from './plugins';
import { JobLayoutComponent } from './job-layout/job-layout.component';
import { createJobsRoutes } from './job.routes';

@NgModule({
	declarations: [JobLayoutComponent],
	imports: [SharedModule, RouterModule.forChild([]), ...PLUGINS],
	exports: [RouterModule],
	providers: [
		{
			provide: ROUTES,
			useFactory: (service: PageRouteRegistryService) => createJobsRoutes(service),
			deps: [PageRouteRegistryService],
			multi: true
		}
	]
})
export class JobsModule {}
