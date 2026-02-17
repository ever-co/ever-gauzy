import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbCardModule, NbIconModule, NbSelectModule, NbSpinnerModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { DailyStatisticsComponent } from './daily-statistics/daily-statistics.component';
import { CounterPointModule } from '../../counter-point/counter-point.module';
import { SharedModule } from '../../shared.module';
import { DurationFormatPipe } from '../../pipes/duration-format.pipe';

@NgModule({
	declarations: [DailyStatisticsComponent],
	exports: [DailyStatisticsComponent],
	imports: [
		CommonModule,
		DurationFormatPipe,
		FormsModule,
		NbCardModule,
		NbIconModule,
		NbSelectModule,
		NbSpinnerModule,
		TranslateModule.forChild(),
		SharedModule,
		CounterPointModule
	]
})
export class DailyStatisticsModule {}
