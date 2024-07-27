import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbIconModule, NbSelectModule } from '@nebular/theme';
import { NgChartsModule } from 'ng2-charts';
import { TranslateModule } from '@ngx-translate/core';
import { EmployeeChartsComponent } from './employee-charts.component';
import { EmployeeDoughnutChartComponent } from './employee-doughnut-chart/employee-doughnut-chart.component';
import { EmployeeHorizontalBarChartComponent } from './employee-horizontal-bar-chart/employee-horizontal-bar-chart.component';
import { EmployeeStackedBarChartComponent } from './employee-stacked-bar-chart/employee-stacked-bar-chart.component';

@NgModule({
	imports: [CommonModule, NgChartsModule, NbIconModule, NbSelectModule, TranslateModule.forChild()],
	exports: [EmployeeChartsComponent],
	declarations: [
		EmployeeChartsComponent,
		EmployeeHorizontalBarChartComponent,
		EmployeeStackedBarChartComponent,
		EmployeeDoughnutChartComponent
	]
})
export class EmployeeChartsModule {}
