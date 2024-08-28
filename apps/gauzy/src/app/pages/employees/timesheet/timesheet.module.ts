import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { DynamicTabsModule, SharedModule } from '@gauzy/ui-core/shared';
import { TimesheetRoutingModule } from './timesheet-routing.module';
import { TimesheetLayoutComponent } from './layout/layout.component';

@NgModule({
	imports: [
		CommonModule,
		NbCardModule,
		TranslateModule.forChild(),
		TimesheetRoutingModule,
		SharedModule,
		DynamicTabsModule
	],
	declarations: [TimesheetLayoutComponent],
	exports: []
})
export class TimesheetModule {}
