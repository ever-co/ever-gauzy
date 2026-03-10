import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbCardModule, NbIconModule, NbSelectModule, NbSpinnerModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { DailyStatisticsComponent } from './daily-statistics/daily-statistics.component';
import { CounterPointComponent } from '../../counter-point/counter-point.component';
import { SharedModule } from '../../shared.module';

@NgModule({
	declarations: [DailyStatisticsComponent],
	exports: [DailyStatisticsComponent],
	imports: [
		CommonModule,
		FormsModule,
		NbCardModule,
		NbIconModule,
		NbSelectModule,
		NbSpinnerModule,
		TranslateModule.forChild(),
		SharedModule,
		CounterPointComponent
	]
})
export class DailyStatisticsModule {}
