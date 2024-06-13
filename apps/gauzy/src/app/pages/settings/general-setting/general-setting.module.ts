import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbRouteTabsetModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { FeatureToggleModule } from '@gauzy/ui-sdk/shared';
import { GeneralSettingRoutingModule } from './general-setting-routing.module';
import { GeneralSettingComponent } from './general-setting.component';

@NgModule({
	imports: [
		CommonModule,
		NbCardModule,
		NbRouteTabsetModule,
		I18nTranslateModule.forChild(),
		GeneralSettingRoutingModule,
		FeatureToggleModule
	],
	declarations: [GeneralSettingComponent]
})
export class GeneralSettingModule {}
