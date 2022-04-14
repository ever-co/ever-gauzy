import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DailyStatisticsComponent } from './daily-statistics/daily-statistics.component';
import { FormsModule } from '@angular/forms';
import {
	NbIconModule,
	NbSpinnerModule,
	NbCardModule,
	NbSelectModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '../../shared.module';
import { FiltersModule } from '../../timesheet/filters/filters.module';
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
		FiltersModule,
		NbSelectModule,
		FormsModule,
        CounterPointModule,
	]
})
export class DailyStatisticsModule {}
