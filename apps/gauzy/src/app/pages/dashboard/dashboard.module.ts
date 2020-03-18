import { HttpClient } from '@angular/common/http';
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
	NbSelectModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { ChartModule } from 'angular2-chartjs';
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
import { EmployeeStatisticsComponent } from './employee-statistics/employee-statistics.component';
import { OrganizationEmployeesComponent } from './organization-employees/organization-employees.component';
import { InfoBlockModule } from '../../@shared/dashboard/info-block/info-block.module';
import { EmployeeHorizontalBarChartComponent } from './employee-charts/employee-horizontal-bar-chart/employee-horizontal-bar-chart.component';
import { EmployeeDoughnutChartComponent } from './employee-charts/employee-doughnut-chart/employee-doughnut-chart.component';
import { EmployeeStackedBarChartComponent } from './employee-charts/employee-stacked-bar-chart/employee-stacked-bar-chart.component';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

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
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		ChartModule,
		NbSpinnerModule,
		SingleStatisticModule,
		InfoBlockModule
	],
	declarations: [
		DashboardComponent,
		EmployeeHorizontalBarChartComponent,
		EmployeeStackedBarChartComponent,
		EmployeeDoughnutChartComponent,
		OrganizationEmployeesComponent,
		EmployeeStatisticsComponent,
		DataEntryShortcutsComponent
	],
	providers: [IncomeService, ExpensesService, AuthService]
})
export class DashboardModule {}
