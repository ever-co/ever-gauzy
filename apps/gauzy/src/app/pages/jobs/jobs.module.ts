import { NgModule } from '@angular/core';
import { RouterModule, ROUTES } from '@angular/router';
import { PageRouteRegistryService } from '@gauzy/ui-core/core';
import { SharedModule } from '@gauzy/ui-core/shared';
import { JobEmployeeModule } from '@gauzy/plugin-job-employee-ui';
import { JobMatchingModule } from '@gauzy/plugin-job-matching-ui';
import { JobProposalTemplateModule } from '@gauzy/plugin-job-proposal-ui';
import { JobSearchModule } from '@gauzy/plugin-job-search-ui';
import { JobLayoutComponent } from './job-layout/job-layout.component';
import { createJobsRoutes } from './job.routes';

/** Job-related plugin modules (order can affect default redirect; employee is first). */
const JOB_PLUGIN_MODULES = [JobEmployeeModule, JobMatchingModule, JobProposalTemplateModule, JobSearchModule] as const;

@NgModule({
	declarations: [JobLayoutComponent],
	imports: [SharedModule, RouterModule.forChild([]), ...JOB_PLUGIN_MODULES],
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
