import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbDatepickerModule, NbIconModule } from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '../shared.module';
import { TimerPickerComponent } from './timer-picker/timer-picker.component';
import { TimerRangePickerComponent } from './timer-range-picker/timer-range-picker.component';
import { ManualTimerPickerComponent } from './manual-timer-picker/manual-timer-picker.component';

@NgModule({
	declarations: [TimerPickerComponent, TimerRangePickerComponent, ManualTimerPickerComponent],
	exports: [TimerPickerComponent, TimerRangePickerComponent, ManualTimerPickerComponent],
	imports: [
		CommonModule,
		FormsModule,
		NbDatepickerModule,
		NbIconModule,
		NgSelectModule,
		TranslateModule.forChild(),
		SharedModule
	]
})
export class TimerPickerModule {}
