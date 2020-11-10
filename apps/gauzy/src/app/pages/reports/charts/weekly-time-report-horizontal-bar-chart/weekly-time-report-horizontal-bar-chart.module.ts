import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WeeklyTimeReportHorizontalBarChartComponent } from './weekly-time-report-horizontal-bar-chart.component';
import { NbIconModule } from '@nebular/theme';
import { ChartModule } from 'angular2-chartjs';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
	declarations: [WeeklyTimeReportHorizontalBarChartComponent],
	exports: [WeeklyTimeReportHorizontalBarChartComponent],
	imports: [CommonModule, NbIconModule, ChartModule, TranslateModule]
})
export class WeeklyTimeReportHorizontalBarChartModule {}
