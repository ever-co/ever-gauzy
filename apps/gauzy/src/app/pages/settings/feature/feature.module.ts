import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbRouteTabsetModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { FeatureToggleModule, SharedModule } from '@gauzy/ui-core/shared';
import { FeatureRoutingModule } from './feature-routing.module';
import { FeatureComponent } from './feature.component';

@NgModule({
	imports: [
		CommonModule,
		NbCardModule,
		NbRouteTabsetModule,
		TranslatePipe,
		FeatureRoutingModule,
		FeatureToggleModule,
		SharedModule
	],
	declarations: [FeatureComponent],
	providers: []
})
export class FeatureModule {}
