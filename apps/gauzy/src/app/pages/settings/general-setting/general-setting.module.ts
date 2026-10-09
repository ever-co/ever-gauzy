import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
	NbAccordionModule,
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbInputModule,
	NbRadioModule,
	NbRouteTabsetModule,
	NbSelectModule,
	NbSpinnerModule,
	NbToggleModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { LanguagesService, TenantService } from '@gauzy/ui-core/core';
import { FeatureToggleModule, ImageUploaderModule, SharedModule } from '@gauzy/ui-core/shared';
import { GeneralSettingRoutingModule } from './general-setting-routing.module';
import { GeneralSettingComponent } from './general-setting.component';
import { PersonalSettingsComponent } from './personal-settings/personal-settings.component';

@NgModule({
	imports: [
		CommonModule,
		ReactiveFormsModule,
		RouterModule,
		NbAccordionModule,
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbInputModule,
		NbRadioModule,
		NbRouteTabsetModule,
		NbSelectModule,
		NbSpinnerModule,
		NbToggleModule,
		TranslateModule.forChild(),
		GeneralSettingRoutingModule,
		FeatureToggleModule,
		ImageUploaderModule,
		SharedModule
	],
	declarations: [GeneralSettingComponent, PersonalSettingsComponent],
	providers: [LanguagesService, TenantService]
})
export class GeneralSettingModule {}
