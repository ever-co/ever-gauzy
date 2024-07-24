import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ROUTES } from '@angular/router';
import { SharedModule } from '@gauzy/ui-core/shared';
import { PageRouteService } from '@gauzy/ui-core/core';
import { JobLayoutComponent } from './job-layout/job-layout.component';
import { JobTableComponentsModule } from './table-components/job-table-components.module';
import { createRoutes } from './job.routes';

@NgModule({
	declarations: [JobLayoutComponent],
	imports: [CommonModule, RouterModule.forChild([]), SharedModule, JobTableComponentsModule],
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
	constructor(readonly _pageRouteService: PageRouteService) {
		// Register Job Browser Page Routes
		_pageRouteService.registerPageRoute({
			// Register the location 'jobs'
			location: 'jobs',
			// Register the path 'search'
			path: 'search',
			// Register the loadChildren function to load the MatchingModule lazy module
			loadChildren: () => import('./search/search.module').then((m) => m.SearchModule),
			// Register the data object
			data: {
				selectors: {
					date: true,
					employee: true,
					project: false,
					team: false
				}
			}
		});
		// Register Job Matching Page Routes
		_pageRouteService.registerPageRoute({
			// Register the location 'jobs'
			location: 'jobs',
			// Register the path 'matching'
			path: 'matching',
			// Register the loadChildren function to load the MatchingModule lazy module
			loadChildren: () => import('./matching/matching.module').then((m) => m.MatchingModule),
			// Register the data object
			data: {
				selectors: {
					date: true,
					employee: true,
					project: false,
					team: false
				}
			}
		});
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
					project: false
				}
			}
		});
		// Register Job Employee Page Routes
		_pageRouteService.registerPageRoute({
			// Register the location 'jobs'
			location: 'jobs',
			// Register the path 'employee'
			path: 'employee',
			// Register the loadChildren function to load the EmployeesModule lazy module
			loadChildren: () => import('./employees/employees.module').then((m) => m.EmployeesModule),
			// Register the data object
			data: {
				selectors: {
					date: true,
					employee: true,
					project: false,
					team: false
				}
			}
		});
	}
}
