import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbIconModule } from '@nebular/theme';
import { NgChartsModule } from 'ng2-charts';
import { TranslateModule } from '../../../translate/translate.module';
import { LineChartComponent } from './line-chart.component';

@NgModule({
	declarations: [LineChartComponent],
	exports: [LineChartComponent],
	imports: [
		CommonModule,
		NbIconModule,
		NgChartsModule,
		TranslateModule
	]
})
export class LineChartModule { }
