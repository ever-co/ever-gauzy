import { NgModule } from '@angular/core';
import { NbCardModule, NbRouteTabsetModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '@gauzy/ui-core/shared';
import { ActivityRoutingModule } from './activity-routing.module';
import { ActivityLayoutComponent } from './layout/layout.component';

@NgModule({
	declarations: [ActivityLayoutComponent],
	imports: [NbCardModule, NbRouteTabsetModule, TranslateModule.forChild(), ActivityRoutingModule, SharedModule]
})
export class ActivityModule {}
