import { NgModule } from '@angular/core';
import { RouterModule, ROUTES } from '@angular/router';
import { SharedModule } from '@gauzy/ui-core/shared';
import { PageRouteService } from '@gauzy/ui-core/core';
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
			useFactory: (pageRouteService: PageRouteService) => createRoutes(pageRouteService),
			deps: [PageRouteService],
			multi: true
		}
	]
})
export class JobsModule {
	constructor(private readonly _pageRouteService: PageRouteService) {
		// Register the routes
		this.registerRoutes(this._pageRouteService);
	}

	/**
	 * Register routes for the Jobs module
	 *
	 * @param _pageRouteService
	 * @returns {void}
	 */
	registerRoutes(_pageRouteService: PageRouteService): void {
		// Register Job Proposal Template Page Routes
		_pageRouteService.registerPageRoute({
			// Register the location 'jobs'
			location: 'jobs',
			// Register the path 'proposal-template'
			path: 'proposal-template',
			// Register the loadChildren function to load the ProposalTemplateModule lazy module
			loadChildren: () =>
				import('./proposal-template/proposal-template.module').then((m) => m.ProposalTemplateModule),
			// Register the data object
			data: {
				selectors: {
					project: false,
					team: false
				}
			}
		});
	}
}
