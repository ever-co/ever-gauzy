import { Inject, NgModule } from '@angular/core';
import { ROUTES, RouterModule } from '@angular/router';
import { NbCardModule, NbSpinnerModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { BookmarkQueryParamsResolver, PageRouteRegistryService } from '@gauzy/ui-core/core';
import {
	ActivityItemModule,
	DateRangePickerResolver,
	DynamicTabsModule,
	GauzyFiltersModule,
	NoDataMessageModule,
	SharedModule
} from '@gauzy/ui-core/shared';
import { createActivityRoutes } from './activity.routes';
import { ActivityLayoutComponent } from './layout/layout.component';
import { AppUrlActivityComponent } from './app-url-activity/app-url-activity.component';

@NgModule({
	imports: [
		RouterModule.forChild([]),
		NbCardModule,
		NbSpinnerModule,
		TranslateModule.forChild(),
		ActivityItemModule,
		DynamicTabsModule,
		GauzyFiltersModule,
		NoDataMessageModule,
		SharedModule
	],
	declarations: [ActivityLayoutComponent, AppUrlActivityComponent],
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
			location: 'time-activity',
			path: 'time-activities',
			loadChildren: () =>
				import('./time-activities/time-activities.module').then((m) => m.TimeAndActivitiesModule)
		});

		// Register Screenshot Page Routes
		this._pageRouteRegistryService.registerPageRoute({
			location: 'time-activity',
			path: 'screenshots',
			loadChildren: () => import('./screenshot/screenshot.module').then((m) => m.ScreenshotModule)
		});

		// Register Screenshot Page Routes
		this._pageRouteRegistryService.registerPageRoute({
			location: 'time-activity',
			path: 'videos',
			loadChildren: () => import('@gauzy/plugin-videos-ui').then((m) => m.VideoUiModule)
		});

		// Register App Activity Page Routes
		this._pageRouteRegistryService.registerPageRoute({
			location: 'time-activity',
			path: 'apps',
			component: AppUrlActivityComponent,
			data: {
				datePicker: {
					unitOfTime: 'day',
					isLockDatePicker: true,
					isSaveDatePicker: true,
					isSingleDatePicker: true,
					isDisableFutureDate: true
				},
				title: 'ACTIVITY.APPS', // Register the title for the page
				type: 'apps' // Register the type for the page
			},
			resolve: {
				dates: DateRangePickerResolver,
				bookmarkParams: BookmarkQueryParamsResolver
			}
		});

		// Register URL Activity Page Routes
		this._pageRouteRegistryService.registerPageRoute({
			location: 'time-activity',
			path: 'urls',
			component: AppUrlActivityComponent,
			data: {
				datePicker: {
					unitOfTime: 'day',
					isLockDatePicker: true,
					isSaveDatePicker: true,
					isSingleDatePicker: true,
					isDisableFutureDate: true
				},
				title: 'ACTIVITY.VISITED_SITES', // Register the title for the page
				type: 'urls' // Register the type for the page
			},
			resolve: {
				dates: DateRangePickerResolver,
				bookmarkParams: BookmarkQueryParamsResolver
			}
		});

		// Set the flag to true
		ActivityModule.hasRegisteredPageRoutes = true;
	}
}
