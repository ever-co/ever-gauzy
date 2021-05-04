// tslint:disable: nx-enforce-module-boundaries
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimesheetRoutingModule } from './timesheet-routing.module';
import { SharedModule } from 'apps/gauzy/src/app/@shared/shared.module';
import { NbRouteTabsetModule, NbCardModule } from '@nebular/theme';
import { LayoutComponent } from './layout/layout.component';
import { TranslateModule } from '@ngx-translate/core';
import { HeaderTitleModule } from '../../../@shared/components/header-title/header-title.module';

@NgModule({
	declarations: [LayoutComponent],
	exports: [],
	entryComponents: [],
	imports: [
		CommonModule,
		TimesheetRoutingModule,
		SharedModule,
		NbRouteTabsetModule,
		NbCardModule,
		TranslateModule,
		HeaderTitleModule
	]
})
export class TimesheetModule {}
