import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbRouteTabsetModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '@gauzy/ui-core/shared';
import { ActivityRoutingModule } from './activity-routing.module';
import { ActivityLayoutComponent } from './layout/layout.component';

@NgModule({
	declarations: [ActivityLayoutComponent],
	imports: [
		CommonModule,
		NbCardModule,
		NbRouteTabsetModule,
		TranslateModule.forChild(),
		ActivityRoutingModule,
		SharedModule
	]
})
export class ActivityModule {}
