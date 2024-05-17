import { NgModule } from '@angular/core';
import { NbCardModule, NbRouteTabsetModule } from '@nebular/theme';
import { ThemeModule } from '../../../@theme/theme.module';
import { FeatureToggleModule } from '../../../@shared/feature-toggle/feature-toggle.module';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { GeneralSettingRoutingModule } from './general-setting-routing.module';
import { GeneralSettingComponent } from './general-setting.component';

@NgModule({
	imports: [
		ThemeModule,
		NbCardModule,
		NbRouteTabsetModule,
		TranslateModule,
		FeatureToggleModule,
		GeneralSettingRoutingModule
	],
	declarations: [GeneralSettingComponent],
	providers: []
})
export class GeneralSettingModule {}
