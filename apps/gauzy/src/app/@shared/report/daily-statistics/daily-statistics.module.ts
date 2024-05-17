import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DailyStatisticsComponent } from './daily-statistics/daily-statistics.component';
import { FormsModule } from '@angular/forms';
import { NbIconModule, NbSpinnerModule, NbCardModule, NbSelectModule } from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { SharedModule } from '../../shared.module';
import { CounterPointModule } from '../../counter-point/counter-point.module';

@NgModule({
	declarations: [DailyStatisticsComponent],
	exports: [DailyStatisticsComponent],
	imports: [
		CommonModule,
		SharedModule,
		TranslateModule,
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		NbSelectModule,
		FormsModule,
		CounterPointModule
	]
})
export class DailyStatisticsModule {}
