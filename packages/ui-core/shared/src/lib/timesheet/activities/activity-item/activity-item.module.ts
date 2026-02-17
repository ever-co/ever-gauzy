import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbIconModule, NbProgressBarModule, NbTooltipModule } from '@nebular/theme';
import { MomentModule } from 'ngx-moment';
import { TranslateModule } from '@ngx-translate/core';
import { ActivityItemComponent } from './activity-item.component';
import { SharedModule } from '../../../shared.module';
import { DurationFormatPipe } from '../../../pipes/duration-format.pipe';

@NgModule({
	declarations: [ActivityItemComponent],
	exports: [ActivityItemComponent],
	imports: [
		CommonModule,
		DurationFormatPipe,
		MomentModule,
		NbButtonModule,
		NbIconModule,
		NbProgressBarModule,
		NbTooltipModule,
		TranslateModule.forChild(),
		SharedModule
	]
})
export class ActivityItemModule {}
