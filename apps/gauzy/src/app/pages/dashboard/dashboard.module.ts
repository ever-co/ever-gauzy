import { NgModule } from '@angular/core';
import {
	NbAlertModule,
	NbButtonModule,
	NbCardModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbRouteTabsetModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTooltipModule,
	NbTreeGridModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateModule } from '@ngx-translate/core';
import {
	DynamicTabsModule,
	InfoBlockModule,
	LineChartModule,
	NoDataMessageModule,
	ProfitHistoryModule,
	RecordsHistoryModule,
	SharedModule,
	SingleStatisticModule,
	TableComponentsModule,
	WorkInProgressModule
} from '@gauzy/ui-core/shared';
import { DashboardRoutingModule } from './dashboard-routing.module';
import { DashboardComponent } from './dashboard.component';
import { DataEntryShortcutsComponent } from './data-entry-shortcuts/data-entry-shortcuts.component';
import { HumanResourcesComponent } from './human-resources/human-resources.component';
import { AccountingComponent } from './accounting/accounting.component';
import { ProjectManagementComponent } from './project-management/project-management.component';
import { EmployeeChartsModule } from './human-resources/employee-charts/employee-charts.module';
import { TimeTrackingModule } from './time-tracking/time-tracking.module';
import { ProjectManagementDetailsComponent } from './project-management/project-management-details/project-management-details.component';
import { TeamModule } from './team/team.module';

// NB Modules
const NB_MODULES = [
	NbAlertModule,
	NbButtonModule,
	NbCardModule,
	NbDialogModule.forChild(),
	NbIconModule,
	NbInputModule,
	NbRouteTabsetModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTooltipModule,
	NbTreeGridModule
];

// Third Party Modules
const THIRD_PARTY_MODULES = [
	InfiniteScrollModule,
	LineChartModule,
	NgSelectModule,
	NgxPermissionsModule.forChild(),
	TranslateModule.forChild()
];

@NgModule({
	imports: [
		DashboardRoutingModule,
		...NB_MODULES,
		...THIRD_PARTY_MODULES,
		// Feature Modules
		RecordsHistoryModule,
		ProfitHistoryModule,
		EmployeeChartsModule,
		SingleStatisticModule,
		InfoBlockModule,
		TimeTrackingModule,
		TeamModule,
		// Shared Modules
		SharedModule,
		TableComponentsModule,
		NoDataMessageModule,
		WorkInProgressModule,
		// Custom Modules
		DynamicTabsModule
	],
	declarations: [
		DashboardComponent,
		AccountingComponent,
		HumanResourcesComponent,
		DataEntryShortcutsComponent,
		ProjectManagementComponent,
		ProjectManagementDetailsComponent
	]
})
export class DashboardModule {}
