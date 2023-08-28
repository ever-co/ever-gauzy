import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimeTrackerStatusService } from './time-tracker-status.service';
import { TimeTrackerStatusComponent } from './time-tracker-status.component';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { TranslateModule } from '@ngx-translate/core';
import { NbTooltipModule } from '@nebular/theme';

@NgModule({
	declarations: [TimeTrackerStatusComponent],
	imports: [
		CommonModule,
		FontAwesomeModule,
		TranslateModule,
		NbTooltipModule,
		TranslateModule,
	],
	exports: [TimeTrackerStatusComponent],
	providers: [TimeTrackerStatusService],
})
export class TimeTrackerStatusModule {}
