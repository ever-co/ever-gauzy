import { NgModule } from '@angular/core';
import { NbCardModule, NbRouteTabsetModule } from '@nebular/theme';
import { ThemeModule } from '../../../@theme/theme.module';
import { FeatureRoutingModule } from './feature-routing.module';
import { FeatureComponent } from './feature.component';
import { FeatureToggleModule } from '../../../@shared/feature-toggle/feature-toggle.module';
import { TranslaterModule } from '../../../@shared/translater/translater.module';

@NgModule({
	imports: [
		FeatureRoutingModule,
		ThemeModule,
		NbCardModule,
		NbRouteTabsetModule,
		TranslaterModule,
		FeatureToggleModule
	],
	declarations: [FeatureComponent],
	providers: []
})
export class FeatureModule {}
