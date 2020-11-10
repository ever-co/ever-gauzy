import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimeReportHorizontalBarChartComponent } from './time-report-horizontal-bar-chart.component';
import { NbIconModule } from '@nebular/theme';
import { ChartModule } from 'angular2-chartjs';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
	declarations: [TimeReportHorizontalBarChartComponent],
	exports: [TimeReportHorizontalBarChartComponent],
	imports: [CommonModule, NbIconModule, ChartModule, TranslateModule]
})
export class TimeReportHorizontalBarChartModule {}
