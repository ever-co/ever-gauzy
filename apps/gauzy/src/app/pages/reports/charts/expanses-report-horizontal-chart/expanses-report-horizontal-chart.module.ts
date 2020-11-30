import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExpansesReportHorizontalChartComponent } from './expanses-report-horizontal-chart.component';
import { NbIconModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { ChartModule } from 'angular2-chartjs';

@NgModule({
	declarations: [ExpansesReportHorizontalChartComponent],
	exports: [ExpansesReportHorizontalChartComponent],
	imports: [CommonModule, NbIconModule, ChartModule, TranslateModule]
})
export class ExpansesReportHorizontalChartModule {}
