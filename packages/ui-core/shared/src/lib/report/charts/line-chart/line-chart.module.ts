import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbIconModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { BaseChartDirective } from 'ng2-charts';
import { LineChartComponent } from './line-chart.component';

@NgModule({
	declarations: [LineChartComponent],
	exports: [LineChartComponent],
	imports: [CommonModule, NbIconModule, TranslatePipe, BaseChartDirective]
})
export class LineChartModule {}
