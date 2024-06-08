import { NgModule } from '@angular/core';
import { NbCardModule, NbRouteTabsetModule } from '@nebular/theme';
import { ThemeModule } from '../../../@theme/theme.module';
import { FeatureRoutingModule } from './feature-routing.module';
import { FeatureComponent } from './feature.component';
import { FeatureToggleModule } from '../../../@shared/feature-toggle/feature-toggle.module';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';

@NgModule({
	imports: [
		FeatureRoutingModule,
		ThemeModule,
		NbCardModule,
		NbRouteTabsetModule,
		I18nTranslateModule.forChild(),
		FeatureToggleModule
	],
	declarations: [FeatureComponent],
	providers: []
})
export class FeatureModule {}
