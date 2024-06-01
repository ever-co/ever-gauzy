import { NgModule } from '@angular/core';
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
import { AuthService } from '../../@core/services/auth.service';
import { ExpensesService } from '../../@core/services/expenses.service';
import { IncomeService } from '../../@core/services/income.service';
import { ProfitHistoryModule } from '../../@shared/dashboard/profit-history/profit-history.module';
import { RecordsHistoryModule } from '../../@shared/dashboard/records-history/records-history.module';
import { SingleStatisticModule } from '../../@shared/single-statistic/single-statistic.module';
import { ThemeModule } from '../../@theme/theme.module';
import { DashboardRoutingModule } from './dashboard-routing.module';
import { DashboardComponent } from './dashboard.component';
import { DataEntryShortcutsComponent } from './data-entry-shortcuts/data-entry-shortcuts.component';
import { HumanResourcesComponent } from './human-resources/human-resources.component';
import { AccountingComponent } from './accounting/accounting.component';
import { InfoBlockModule } from '../../@shared/dashboard/info-block/info-block.module';
import { ProjectManagementComponent } from './project-management/project-management.component';
import { EmployeeChartsModule } from './human-resources/employee-charts/employee-charts.module';
import { TimeTrackingModule } from './time-tracking/time-tracking.module';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { HeaderTitleModule } from '../../@shared/components/header-title/header-title.module';
import { SharedModule } from '../../@shared/shared.module';
import { DateRangeTitleModule } from '../../@shared/components/date-range-title';
import { LineChartModule } from '../../@shared/report/charts/line-chart/line-chart.module';
import { ProjectManagementDetailsComponent } from './project-management/project-management-details/project-management-details.component';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';
import { TableComponentsModule } from '../../@shared';
import { NoDataMessageModule } from '../../@shared/no-data-message/no-data-message.module';
import { WorkInProgressModule } from '../work-in-progress/work-in-progress.module';
import { TeamModule } from './team/team.module';

@NgModule({
	imports: [
		DashboardRoutingModule,
		ThemeModule,
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
		ProfitHistoryModule,
		I18nTranslateModule.forChild(),
		EmployeeChartsModule,
		NbSpinnerModule,
		SingleStatisticModule,
		InfoBlockModule,
		NbRouteTabsetModule,
		TimeTrackingModule,
		HeaderTitleModule,
		SharedModule,
		DateRangeTitleModule,
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
	],
	providers: [IncomeService, ExpensesService, AuthService]
})
export class DashboardModule {}
