// tslint:disable: nx-enforce-module-boundaries
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimesheetRoutingModule } from './timesheet-routing.module';
import { SharedModule } from '@gauzy/ui-core/shared';
import { NbRouteTabsetModule, NbCardModule } from '@nebular/theme';
import { TimesheetLayoutComponent } from './layout/layout.component';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';

@NgModule({
	declarations: [TimesheetLayoutComponent],
	exports: [],
	imports: [
		CommonModule,
		TimesheetRoutingModule,
		SharedModule,
		NbRouteTabsetModule,
		NbCardModule,
		I18nTranslateModule.forChild()
	]
})
export class TimesheetModule {}
