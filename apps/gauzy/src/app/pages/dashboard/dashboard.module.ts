import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
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
import {
	ActivityItemModule,
	CounterPointModule,
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
	WindowLayoutModule,
	WorkInProgressModule
} from '@gauzy/ui-core/shared';
import { DashboardRoutingModule } from './dashboard-routing.module';
import { DashboardComponent } from './dashboard.component';
import { DataEntryShortcutsComponent } from './data-entry-shortcuts/data-entry-shortcuts.component';
import { HumanResourcesComponent } from './human-resources/human-resources.component';
import { AccountingComponent } from './accounting/accounting.component';
import { ProjectManagementComponent } from './project-management/project-management.component';
import { ProjectManagementDetailsComponent } from './project-management/project-management-details/project-management-details.component';
import { TimeTrackingComponent } from './time-tracking/time-tracking.component';
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
	InfiniteScrollDirective // Standalone directive must be imported, not declared
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
	DataEntryShortcutsComponent,
	AccountingComponent,
	HumanResourcesComponent,
	ProjectManagementComponent,
	ProjectManagementDetailsComponent,
	TimeTrackingComponent,
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
		DashboardRoutingModule,
		...NB_MODULES,
		...THIRD_PARTY_MODULES,
		...STANDALONE_MODULES,
		BaseChartDirective,
		// Feature Modules
		RecordsHistoryModule,
		ProfitHistoryModule,
		SingleStatisticModule,
		InfoBlockModule,
		SharedModule,
		TableComponentsModule,
		NoDataMessageModule,
		WorkInProgressModule,
		ActivityItemModule,
		CounterPointModule,
		DynamicTabsModule,
		GalleryModule,
		ScreenshotsItemModule,
		TimezoneFilterModule,
		WidgetLayoutModule,
		WindowLayoutModule
	],
	declarations: [...COMPONENTS],
	schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class DashboardModule {}
