import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivityRoutingModule } from './activity-routing.module';
import { ActivityLayoutComponent } from './layout/layout.component';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { NbCardModule, NbRouteTabsetModule } from '@nebular/theme';
import { SharedModule } from '@gauzy/ui-sdk/shared';

@NgModule({
	declarations: [ActivityLayoutComponent],
	imports: [
		CommonModule,
		NbCardModule,
		NbRouteTabsetModule,
		I18nTranslateModule.forChild(),
		ActivityRoutingModule,
		SharedModule
	]
})
export class ActivityModule {}
