import { inject, NgModule } from '@angular/core';
import { RouterModule, ROUTES } from '@angular/router';
import { FeatureEnum } from '@gauzy/contracts';
import { IOnPluginUiBootstrap, IOnPluginUiDestroy } from '@gauzy/plugin-ui';
import { LoggerService, NavMenuBuilderService, PageRouteRegistryService } from '@gauzy/ui-core/core';
import { SharedModule } from '@gauzy/ui-core/shared';
import { JobLayoutComponent } from './job-layout/job-layout.component';
import { createJobsRoutes } from './job.routes';

@NgModule({
	declarations: [JobLayoutComponent],
	imports: [SharedModule, RouterModule.forChild([])],
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
export class JobsModule implements IOnPluginUiBootstrap, IOnPluginUiDestroy {
	private readonly _log = inject(LoggerService).withContext('JobsModule');
	private readonly _navMenuBuilderService = inject(NavMenuBuilderService);

	constructor() {
		this.registerNavMenuSection();
	}

	ngOnPluginBootstrap(): void {
		this._log.log('Plugin bootstrapped');
	}

	private registerNavMenuSection(): void {
		this._navMenuBuilderService.addNavMenuSection(
			{
				id: 'jobs',
				title: 'Jobs',
				icon: 'fas fa-briefcase',
				link: '/pages/jobs',
				data: {
					translationKey: 'MENU.JOBS',
					featureKey: FeatureEnum.FEATURE_JOB
				},
				items: []
			},
			'employees' // Insert before sales section
		);
	}

	ngOnPluginDestroy(): void {
		this._log.log('Plugin destroyed');
	}
}
