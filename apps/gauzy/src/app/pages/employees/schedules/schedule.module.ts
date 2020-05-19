import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScheduleRoutingModule } from './schedule-routing.module';
import { SharedModule } from 'apps/gauzy/src/app/@shared/shared.module';
import { NbRouteTabsetModule, NbCardModule } from '@nebular/theme';
import { LayoutComponent } from './layout/layout.component';
import { TranslateModule } from '@ngx-translate/core';
import { AvailabilitySlotsService } from '../../../@core/services/availability-slots.service';

@NgModule({
	declarations: [LayoutComponent],
	exports: [],
	entryComponents: [],
	imports: [
		CommonModule,
		ScheduleRoutingModule,
		SharedModule,
		NbRouteTabsetModule,
		NbCardModule,
		TranslateModule
	],
	providers: [AvailabilitySlotsService]
})
export class ScheduleModule {}
