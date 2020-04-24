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
	NbSelectModule,
	NbRouteTabsetModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
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
import { TimeTrackingComponent } from './time-tracking/time-tracking.component';
import { ProjectManagementComponent } from './project-management/project-management.component';
import { EmployeeChartsModule } from './human-resources/employee-charts/employee-charts.module';

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
		EmployeeChartsModule,
		NbSpinnerModule,
		SingleStatisticModule,
		InfoBlockModule,
		NbRouteTabsetModule
	],
	declarations: [
		DashboardComponent,
		AccountingComponent,
		HumanResourcesComponent,
		DataEntryShortcutsComponent,
		TimeTrackingComponent,
		ProjectManagementComponent
	],
	providers: [IncomeService, ExpensesService, AuthService]
})
export class DashboardModule {}
