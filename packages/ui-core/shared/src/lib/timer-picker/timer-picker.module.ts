import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbDatepickerModule, NbIconModule } from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
import { SharedModule } from '../shared.module';
import { TimerPickerComponent } from './timer-picker/timer-picker.component';
import { TimerRangePickerComponent } from './timer-range-picker/timer-range-picker.component';

@NgModule({
	declarations: [TimerPickerComponent, TimerRangePickerComponent],
	exports: [TimerPickerComponent, TimerRangePickerComponent],
	imports: [
		CommonModule,
		FormsModule,
		NbDatepickerModule,
		NbIconModule,
		NgSelectModule,
		I18nTranslateModule.forChild(),
		SharedModule
	]
})
export class TimerPickerModule {}
