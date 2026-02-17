import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbDatepickerModule, NbIconModule } from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '../shared.module';
import { TimerPickerComponent } from './timer-picker/timer-picker.component';
import { TimerRangePickerComponent } from './timer-range-picker/timer-range-picker.component';
import { TimeFormatPipe } from '../pipes/time-format.pipe';

@NgModule({
	declarations: [TimerPickerComponent, TimerRangePickerComponent],
	exports: [TimerPickerComponent, TimerRangePickerComponent],
	imports: [
		CommonModule,
		TimeFormatPipe,
		FormsModule,
		NbDatepickerModule,
		NbIconModule,
		NgSelectModule,
		TranslateModule.forChild(),
		SharedModule
	]
})
export class TimerPickerModule {}
