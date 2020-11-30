import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LineChartComponent } from './line-chart.component';
import { NbIconModule } from '@nebular/theme';
import { ChartModule } from 'angular2-chartjs';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
	declarations: [LineChartComponent],
	exports: [LineChartComponent],
	imports: [CommonModule, NbIconModule, ChartModule, TranslateModule]
})
export class LineChartModule {}
