import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ActivityRoutingModule } from './activity-routing.module';
import { LayoutComponent } from './layout/layout.component';
import { TranslateModule } from '@ngx-translate/core';
import { NbCardModule, NbRouteTabsetModule } from '@nebular/theme';
import { ShareModule } from '../../../share/share.module';
import { HeaderTitleModule } from '../../../@shared/components/header-title/header-title.module';

@NgModule({
	declarations: [LayoutComponent],
	imports: [
		CommonModule,
		ActivityRoutingModule,
		NbCardModule,
		TranslateModule,
		ShareModule,
		NbRouteTabsetModule,
		HeaderTitleModule
	]
})
export class ActivityModule {}
