import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TimesheetRoutingModule } from './timesheet-routing.module';
import { DailyComponent } from './daily/daily.component';
import { NbCardModule, NbCheckboxModule, NbButtonModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '../../../@shared/shared.module';

@NgModule({
	declarations: [DailyComponent],
	imports: [
		CommonModule,
		TimesheetRoutingModule,
		NbCardModule,
		TranslateModule,
		NbCheckboxModule,
		NbButtonModule,
		SharedModule
	]
})
export class TimesheetModule {}
