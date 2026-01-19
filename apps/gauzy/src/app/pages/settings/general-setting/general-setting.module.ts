import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import {
	NbAccordionModule,
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbInputModule,
	NbRouteTabsetModule,
	NbSpinnerModule,
	NbToggleModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { FeatureToggleModule } from '@gauzy/ui-core/shared';
import { GeneralSettingRoutingModule } from './general-setting-routing.module';
import { GeneralSettingComponent } from './general-setting.component';

@NgModule({
	imports: [
		CommonModule,
		ReactiveFormsModule,
		NbAccordionModule,
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbInputModule,
		NbRouteTabsetModule,
		NbSpinnerModule,
		NbToggleModule,
		TranslateModule.forChild(),
		GeneralSettingRoutingModule,
		FeatureToggleModule
	],
	declarations: [GeneralSettingComponent]
})
export class GeneralSettingModule {}
