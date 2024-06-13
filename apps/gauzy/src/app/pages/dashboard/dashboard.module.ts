import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
	NbAlertModule,
	NbButtonModule,
	NbCardModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbSpinnerModule,
	NbTooltipModule,
	NbTreeGridModule,
	NbSelectModule,
	NbRouteTabsetModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';
import { NgxPermissionsModule } from 'ngx-permissions';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import {
	InfoBlockModule,
	LineChartModule,
	NoDataMessageModule,
	ProfitHistoryModule,
	RecordsHistoryModule,
	SharedModule,
	SingleStatisticModule,
	TableComponentsModule
} from '@gauzy/ui-sdk/shared';
import { DashboardRoutingModule } from './dashboard-routing.module';
import { DashboardComponent } from './dashboard.component';
import { DataEntryShortcutsComponent } from './data-entry-shortcuts/data-entry-shortcuts.component';
import { HumanResourcesComponent } from './human-resources/human-resources.component';
import { AccountingComponent } from './accounting/accounting.component';
import { ProjectManagementComponent } from './project-management/project-management.component';
import { EmployeeChartsModule } from './human-resources/employee-charts/employee-charts.module';
import { TimeTrackingModule } from './time-tracking/time-tracking.module';
import { ProjectManagementDetailsComponent } from './project-management/project-management-details/project-management-details.component';
import { WorkInProgressModule } from '../work-in-progress/work-in-progress.module';
import { TeamModule } from './team/team.module';

@NgModule({
	imports: [
		CommonModule,
		DashboardRoutingModule,
		NbCardModule,
		NgSelectModule,
		FormsModule,
		NbButtonModule,
		NbInputModule,
		RecordsHistoryModule,
		NbDialogModule.forChild(),
		NbTreeGridModule,
		NbIconModule,
		NbTooltipModule,
		NbSpinnerModule,
		NbSelectModule,
		NbAlertModule,
		NgxPermissionsModule.forChild(),
		ProfitHistoryModule,
		I18nTranslateModule.forChild(),
		EmployeeChartsModule,
		NbSpinnerModule,
		SingleStatisticModule,
		InfoBlockModule,
		NbRouteTabsetModule,
		TimeTrackingModule,
		SharedModule,
		LineChartModule,
		InfiniteScrollModule,
		TableComponentsModule,
		NoDataMessageModule,
		WorkInProgressModule,
		TeamModule
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
