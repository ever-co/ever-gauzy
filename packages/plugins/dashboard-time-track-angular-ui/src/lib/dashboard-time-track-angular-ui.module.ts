import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { RouterModule, ROUTES } from '@angular/router';
import {
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbListModule,
	NbPopoverModule,
	NbProgressBarModule,
	NbSpinnerModule,
	NbToggleModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { NgxPermissionsModule } from 'ngx-permissions';
import { PageExtensionSlotComponent } from '@gauzy/plugin-ui';
import {
	ActivityItemModule,
	CounterPointComponent,
	GalleryModule,
	ScreenshotsItemModule,
	SharedModule,
	TimezoneFilterModule,
	WidgetLayoutModule,
	WindowLayoutModule
} from '@gauzy/ui-core/shared';
import { TimeTrackingComponent } from './components/time-tracking/time-tracking.component';
import { createTimeTrackingRoutes } from './dashboard-time-track-angular-ui.routes';

// NB Modules
const NB_MODULES = [
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbListModule,
	NbPopoverModule,
	NbProgressBarModule,
	NbSpinnerModule,
	NbToggleModule
];

// Standalone Modules
const STANDALONE_MODULES = [
	PageExtensionSlotComponent // Plugin extension slot for rendering React/Vue/etc widgets
];

@NgModule({
	imports: [
		RouterModule.forChild([]),
		...NB_MODULES,
		...STANDALONE_MODULES,
		NgxPermissionsModule.forChild(),
		TranslateModule.forChild(),

		// Feature Modules
		SharedModule,
		ActivityItemModule,
		CounterPointComponent,
		GalleryModule,
		ScreenshotsItemModule,
		TimezoneFilterModule,
		WidgetLayoutModule,
		WindowLayoutModule
	],
	declarations: [TimeTrackingComponent],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	providers: [
		{
			provide: ROUTES,
			useFactory: () => createTimeTrackingRoutes(),
			multi: true
		}
	]
})
export class DashboardTimeTrackAngularUiModule {}
