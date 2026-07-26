import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { RouterModule, ROUTES } from '@angular/router';
import { DragDropModule } from '@angular/cdk/drag-drop';
import {
	NbAlertModule,
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbListModule,
	NbPopoverModule,
	NbProgressBarModule,
	NbRouteTabsetModule,
	NbSelectModule,
	NbSpinnerModule,
	NbToggleModule,
	NbTooltipModule,
	NbTreeGridModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@ngx-translate/core';
import { BaseChartDirective } from 'ng2-charts';
import { InfiniteScrollDirective } from 'ngx-infinite-scroll';
import { NgxPermissionsModule } from 'ngx-permissions';
import { PageExtensionSlotComponent } from '@gauzy/plugin-ui';
import {
	ActivityItemModule,
	CounterPointComponent,
	DashboardWidgetHostComponent,
	DialogsModule,
	DynamicTabsModule,
	GalleryModule,
	InfoBlockModule,
	LineChartModule,
	NoDataMessageModule,
	ProfitHistoryModule,
	RecordsHistoryModule,
	ScreenshotsItemModule,
	SharedModule,
	SingleStatisticModule,
	TableComponentsModule,
	TimezoneFilterModule,
	WidgetLayoutModule,
	WindowLayoutModule
} from '@gauzy/ui-core/shared';
import { PageRouteRegistryService } from '@gauzy/ui-core/core';
import { createDashboardRoutes } from './dashboard.routes';
import { DashboardComponent } from './dashboard.component';
import { DashboardSwitcherComponent } from './dashboard-switcher/dashboard-switcher.component';
import { CustomDashboardComponent } from './custom-dashboard/custom-dashboard.component';
import { DashboardCanvasComponent } from './custom-dashboard/dashboard-canvas.component';
import { WidgetPaletteComponent } from './custom-dashboard/widget-palette.component';
import { DashboardTabStripComponent } from './custom-dashboard/dashboard-tab-strip.component';
import { HumanResourcesComponent } from './human-resources/human-resources.component';
import { AccountingComponent } from './accounting/accounting.component';
import { ProjectManagementComponent } from './project-management/project-management.component';
import { ProjectManagementDetailsComponent } from './project-management/project-management-details/project-management-details.component';
import {
	EmployeeChartsComponent,
	EmployeeDoughnutChartComponent,
	EmployeeHorizontalBarChartComponent,
	EmployeeStackedBarChartComponent
} from './employee-charts';
import { AllTeamComponent, ChartComponent, TeamCardComponent, TeamComponent, TeamMemberComponent } from './team';

// NB Modules
const NB_MODULES = [
	NbAlertModule,
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbDialogModule.forChild(),
	NbIconModule,
	NbInputModule,
	NbListModule,
	NbPopoverModule,
	NbProgressBarModule,
	NbRouteTabsetModule,
	NbSelectModule,
	NbSpinnerModule,
	NbToggleModule,
	NbTooltipModule,
	NbTreeGridModule
];

// Standalone Modules
const STANDALONE_MODULES = [
	InfiniteScrollDirective, // Standalone directive must be imported, not declared
	PageExtensionSlotComponent // Plugin extension slot for rendering React/Vue/etc widgets
];

// Third Party Modules
const THIRD_PARTY_MODULES = [
	LineChartModule,
	NgSelectModule,
	NgxPermissionsModule.forChild(),
	TranslateModule.forChild()
];

// Components
const COMPONENTS = [
	DashboardComponent,
	DashboardSwitcherComponent,
	// Dashboard builder: canvas page, grid canvas, widget palette, tab strip
	CustomDashboardComponent,
	DashboardCanvasComponent,
	WidgetPaletteComponent,
	DashboardTabStripComponent,
	AccountingComponent,
	HumanResourcesComponent,
	ProjectManagementComponent,
	ProjectManagementDetailsComponent,
	EmployeeChartsComponent,
	EmployeeHorizontalBarChartComponent,
	EmployeeStackedBarChartComponent,
	EmployeeDoughnutChartComponent,
	TeamComponent,
	TeamCardComponent,
	TeamMemberComponent,
	ChartComponent,
	AllTeamComponent
];

@NgModule({
	imports: [
		RouterModule.forChild([]),
		...NB_MODULES,
		...THIRD_PARTY_MODULES,
		...STANDALONE_MODULES,
		BaseChartDirective,
		// Dashboard builder: CDK drag & drop (canvas + palette + tab strip)
		// and the standalone widget host that instantiates palette widgets.
		DragDropModule,
		DashboardWidgetHostComponent,
		// Feature Modules
		DialogsModule,
		RecordsHistoryModule,
		ProfitHistoryModule,
		SingleStatisticModule,
		InfoBlockModule,
		SharedModule,
		TableComponentsModule,
		NoDataMessageModule,
		ActivityItemModule,
		CounterPointComponent,
		DynamicTabsModule,
		GalleryModule,
		ScreenshotsItemModule,
		TimezoneFilterModule,
		WidgetLayoutModule,
		WindowLayoutModule
	],
	declarations: [...COMPONENTS],
	exports: [RouterModule],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	providers: [
		{
			provide: ROUTES,
			useFactory: (_pageRouteRegistryService: PageRouteRegistryService) =>
				createDashboardRoutes(_pageRouteRegistryService),
			deps: [PageRouteRegistryService],
			multi: true
		}
	]
})
export class DashboardModule {}
