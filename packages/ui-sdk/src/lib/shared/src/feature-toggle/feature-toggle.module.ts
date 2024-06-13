import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbIconModule,
	NbListModule,
	NbSpinnerModule,
	NbToggleModule
} from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { FeatureService, FeatureStoreService } from '@gauzy/ui-sdk/core';
import { FeatureToggleComponent } from './feature-toggle.component';

@NgModule({
	imports: [
		CommonModule,
		NbButtonModule,
		NbCardModule,
		NbCheckboxModule,
		NbIconModule,
		NbListModule,
		NbSpinnerModule,
		NbToggleModule,
		I18nTranslateModule.forChild()
	],
	declarations: [FeatureToggleComponent],
	exports: [FeatureToggleComponent],
	providers: [FeatureService, FeatureStoreService]
})
export class FeatureToggleModule {}
