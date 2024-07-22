import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbIconModule } from '@nebular/theme';
import { NgChartsModule } from 'ng2-charts';
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
import { LineChartComponent } from './line-chart.component';

@NgModule({
	declarations: [LineChartComponent],
	exports: [LineChartComponent],
	imports: [CommonModule, NbIconModule, NgChartsModule, I18nTranslateModule.forChild()]
})
export class LineChartModule {}
