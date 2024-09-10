import { Inject, NgModule } from '@angular/core';
import { ROUTES, RouterModule } from '@angular/router';
import { NbCardModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { PageRouteRegistryService } from '@gauzy/ui-core/core';
import { DynamicTabsModule, SharedModule } from '@gauzy/ui-core/shared';
import { createActivityRoutes } from './activity.routes';
import { ActivityLayoutComponent } from './layout/layout.component';

const COMPONENTS = [];

@NgModule({
	imports: [RouterModule.forChild([]), NbCardModule, TranslateModule.forChild(), SharedModule, DynamicTabsModule],
	declarations: [ActivityLayoutComponent, ...COMPONENTS],
	providers: [
		{
			provide: ROUTES,
			useFactory: (service: PageRouteRegistryService) => createActivityRoutes(service),
			deps: [PageRouteRegistryService],
			multi: true
		}
	]
})
export class ActivityModule {
	private static hasRegisteredPageRoutes = false; // Flag to check if routes have been registered

	constructor(@Inject(PageRouteRegistryService) readonly _pageRouteRegistryService: PageRouteRegistryService) {
		// Register the routes
		this.registerPageRoutes();
	}

	/**
	 * Registers page routes for the activity module.
	 * Ensures that routes are registered only once.
	 *
	 * @returns {void}
	 */
	registerPageRoutes(): void {
		if (ActivityModule.hasRegisteredPageRoutes) {
			return;
		}

		// Register Time & Activity Page Routes
		this._pageRouteRegistryService.registerPageRoute({
			// Register the location 'time-activity'
			location: 'time-activity',
			// Register the path 'search'
			path: 'time-activities',
			// Register the loadChildren function to load the ActivityModule lazy module
			loadChildren: () =>
				import('./time-activities/time-activities.module').then((m) => m.TimeAndActivitiesModule)
		});

		// Register Screenshot Page Routes
		this._pageRouteRegistryService.registerPageRoute({
			// Register the location 'time-activity'
			location: 'time-activity',
			// Register the path 'search'
			path: 'screenshots',
			// Register the loadChildren function to load the ActivityModule lazy module
			loadChildren: () => import('./screenshot/screenshot.module').then((m) => m.ScreenshotModule)
		});

		// Register App/URL Activity Page Routes
		this._pageRouteRegistryService.registerPageRoute({
			// Register the location 'time-activity'
			location: 'time-activity',
			// Register the path 'search'
			path: '',
			// Register the loadChildren function to load the ActivityModule lazy module
			loadChildren: () => import('./app-url-activity/app-url-activity.module').then((m) => m.AppUrlActivityModule)
		});

		// Set the flag to true
		ActivityModule.hasRegisteredPageRoutes = true;
	}
}
