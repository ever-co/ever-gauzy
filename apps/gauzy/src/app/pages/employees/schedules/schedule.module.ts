import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScheduleRoutingModule } from './schedule-routing.module';
import { SharedModule } from '@gauzy/ui-core/shared';
import { NbRouteTabsetModule, NbCardModule } from '@nebular/theme';
import { LayoutComponent } from './layout/layout.component';
import { TranslateModule } from '@ngx-translate/core';
import { AvailabilitySlotsService } from '@gauzy/ui-core/core';

@NgModule({
	declarations: [LayoutComponent],
	exports: [],
	imports: [
		CommonModule,
		ScheduleRoutingModule,
		SharedModule,
		NbRouteTabsetModule,
		NbCardModule,
		TranslateModule.forChild()
	],
	providers: [AvailabilitySlotsService]
})
export class ScheduleModule {}
