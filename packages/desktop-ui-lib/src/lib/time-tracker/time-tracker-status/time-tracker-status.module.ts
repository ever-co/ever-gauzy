import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NbTooltipModule } from '@nebular/theme';
import { TimeTrackerStatusService } from './time-tracker-status.service';
import { TimeTrackerStatusComponent } from './time-tracker-status.component';

@NgModule({
    imports: [
        CommonModule,
        FontAwesomeModule,
        TranslateModule,
        NbTooltipModule,
        TranslateModule,
        TimeTrackerStatusComponent,
    ],
    exports: [TimeTrackerStatusComponent],
    providers: [TimeTrackerStatusService],
})
export class TimeTrackerStatusModule {}
