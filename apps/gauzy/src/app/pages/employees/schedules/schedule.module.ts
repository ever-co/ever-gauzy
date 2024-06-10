import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScheduleRoutingModule } from './schedule-routing.module';
import { SharedModule } from 'apps/gauzy/src/app/@shared/shared.module';
import { NbRouteTabsetModule, NbCardModule } from '@nebular/theme';
import { LayoutComponent } from './layout/layout.component';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { AvailabilitySlotsService } from '@gauzy/ui-sdk/core';

@NgModule({
	declarations: [LayoutComponent],
	exports: [],
	imports: [
		CommonModule,
		ScheduleRoutingModule,
		SharedModule,
		NbRouteTabsetModule,
		NbCardModule,
		I18nTranslateModule.forChild()
	],
	providers: [AvailabilitySlotsService]
})
export class ScheduleModule {}
