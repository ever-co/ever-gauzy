import { inject, NgModule } from '@angular/core';
import { RouterModule, ROUTES } from '@angular/router';
import {
	applyDeclarativeRegistrations,
	IOnPluginUiBootstrap,
	IOnPluginUiDestroy,
	PLUGIN_DEFINITION
} from '@gauzy/plugin-ui';
import { LoggerService, NavMenuBuilderService, PageRouteRegistryService } from '@gauzy/ui-core/core';
import { SharedModule } from '@gauzy/ui-core/shared';
import { JobLayoutComponent } from './job-layout/job-layout.component';
import { getJobsChildRoutes } from './job.routes';

@NgModule({
	declarations: [JobLayoutComponent],
	imports: [SharedModule, RouterModule.forChild([])],
	exports: [RouterModule],
	providers: [
		{
			provide: ROUTES,
			useFactory: (_pageRouteRegistryService: PageRouteRegistryService) =>
				getJobsChildRoutes(_pageRouteRegistryService),
			deps: [PageRouteRegistryService],
			multi: true
		}
	]
})
export class JobsModule implements IOnPluginUiBootstrap, IOnPluginUiDestroy {
	private static hasRegistered = false;

	private readonly _log = inject(LoggerService).withContext('JobsModule');
	private readonly _navMenuBuilderService = inject(NavMenuBuilderService);
	private readonly _pageRouteRegistryService = inject(PageRouteRegistryService);

	constructor() {
		if (JobsModule.hasRegistered) return;

		const def = inject(PLUGIN_DEFINITION);

		applyDeclarativeRegistrations(def, {
			navBuilder: this._navMenuBuilderService,
			pageRouteRegistry: this._pageRouteRegistryService
		});

		JobsModule.hasRegistered = true;
	}

	ngOnPluginBootstrap(): void {
		this._log.log('Plugin bootstrapped');
	}

	ngOnPluginDestroy(): void {
		this._log.log('Plugin destroyed');
	}
}
