import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbIconModule, NbSpinnerModule, NbCardModule, NbSelectModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { SharedModule } from '@gauzy/ui-sdk/shared';
import { DailyStatisticsComponent } from './daily-statistics/daily-statistics.component';
import { CounterPointModule } from '../../counter-point/counter-point.module';

@NgModule({
	declarations: [DailyStatisticsComponent],
	exports: [DailyStatisticsComponent],
	imports: [
		CommonModule,
		SharedModule,
		I18nTranslateModule.forChild(),
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		NbSelectModule,
		FormsModule,
		CounterPointModule
	]
})
export class DailyStatisticsModule {}
