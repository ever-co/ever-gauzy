import { NgModule } from '@angular/core';
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
import { NgChartsModule } from 'ng2-charts';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';
import { NgxPermissionsModule } from 'ngx-permissions';
import { SwiperModule } from 'swiper/angular';
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
import { TeamModule } from './team/team.module';
import { TimeTrackingComponent } from './time-tracking/time-tracking.component';
import {
	EmployeeChartsComponent,
	EmployeeDoughnutChartComponent,
	EmployeeHorizontalBarChartComponent,
	EmployeeStackedBarChartComponent
} from './employee-charts';

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

// Third Party Modules
const THIRD_PARTY_MODULES = [
	InfiniteScrollModule,
	LineChartModule,
	NgSelectModule,
	NgxPermissionsModule.forChild(),
	NgChartsModule,
	SwiperModule,
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
	EmployeeDoughnutChartComponent
];

@NgModule({
	imports: [
		DashboardRoutingModule,
		...NB_MODULES,
		...THIRD_PARTY_MODULES,
		// Feature Modules
		RecordsHistoryModule,
		ProfitHistoryModule,
		SingleStatisticModule,
		InfoBlockModule,
		TeamModule,
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
	declarations: [...COMPONENTS]
})
export class DashboardModule {}
