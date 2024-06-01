// tslint:disable: nx-enforce-module-boundaries
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimesheetRoutingModule } from './timesheet-routing.module';
import { SharedModule } from 'apps/gauzy/src/app/@shared/shared.module';
import { NbRouteTabsetModule, NbCardModule } from '@nebular/theme';
import { TimesheetLayoutComponent } from './layout/layout.component';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { HeaderTitleModule } from '../../../@shared/components/header-title/header-title.module';

@NgModule({
	declarations: [TimesheetLayoutComponent],
	exports: [],
	imports: [
		CommonModule,
		TimesheetRoutingModule,
		SharedModule,
		NbRouteTabsetModule,
		NbCardModule,
		TranslateModule.forChild(),
		HeaderTitleModule
	]
})
export class TimesheetModule {}
