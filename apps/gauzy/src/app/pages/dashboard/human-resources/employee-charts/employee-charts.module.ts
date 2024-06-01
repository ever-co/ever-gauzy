import { NgModule } from '@angular/core';
import { NbIconModule, NbSelectModule } from '@nebular/theme';
import { NgChartsModule } from 'ng2-charts';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { ThemeModule } from 'apps/gauzy/src/app/@theme/theme.module';
import { EmployeeChartsComponent } from './employee-charts.component';
import { EmployeeDoughnutChartComponent } from './employee-doughnut-chart/employee-doughnut-chart.component';
import { EmployeeHorizontalBarChartComponent } from './employee-horizontal-bar-chart/employee-horizontal-bar-chart.component';
import { EmployeeStackedBarChartComponent } from './employee-stacked-bar-chart/employee-stacked-bar-chart.component';

@NgModule({
	imports: [ThemeModule, NgChartsModule, NbIconModule, NbSelectModule, TranslateModule.forChild()],
	exports: [EmployeeChartsComponent],
	declarations: [
		EmployeeChartsComponent,
		EmployeeHorizontalBarChartComponent,
		EmployeeStackedBarChartComponent,
		EmployeeDoughnutChartComponent
	]
})
export class EmployeeChartsModule {}
