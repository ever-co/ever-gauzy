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
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
import { FeatureService, FeatureStoreService } from '@gauzy/ui-core/core';
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
