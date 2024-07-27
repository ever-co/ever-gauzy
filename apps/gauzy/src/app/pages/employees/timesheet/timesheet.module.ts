// tslint:disable: nx-enforce-module-boundaries
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { NbRouteTabsetModule, NbCardModule } from '@nebular/theme';
import { SharedModule } from '@gauzy/ui-core/shared';
import { TimesheetRoutingModule } from './timesheet-routing.module';
import { TimesheetLayoutComponent } from './layout/layout.component';

@NgModule({
	declarations: [TimesheetLayoutComponent],
	exports: [],
	imports: [
		CommonModule,
		TimesheetRoutingModule,
		SharedModule,
		NbRouteTabsetModule,
		NbCardModule,
		TranslateModule.forChild()
	]
})
export class TimesheetModule {}
