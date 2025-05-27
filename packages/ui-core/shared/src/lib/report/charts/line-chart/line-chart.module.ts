import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbIconModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { BaseChartDirective } from 'ng2-charts';
import { LineChartComponent } from './line-chart.component';

@NgModule({
	declarations: [LineChartComponent],
	exports: [LineChartComponent],
	imports: [CommonModule, NbIconModule, TranslateModule.forChild(), BaseChartDirective]
})
export class LineChartModule {}
