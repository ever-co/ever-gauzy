import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbCardModule,
	NbButtonModule,
	NbIconModule,
	NbInputModule,
	NbDatepickerModule,
	NbSelectModule,
	NbToastrModule,
	NbListModule,
	NbStepperModule,
	NbToggleModule,
	NbTooltipModule,
	NbSpinnerModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
import { OrganizationDepartmentsService } from '@gauzy/ui-core/core';
import { OrganizationsStepFormComponent } from './organizations-step-form.component';
import { ImageUploaderModule } from '../../image-uploader/image-uploader.module';
import { RemoveLodashModule } from '../../remove-lodash/remove-lodash.module';
import { TagsColorInputModule } from '../../tags/tags-color-input/tags-color-input.module';
import { LeafletMapModule, LocationFormModule } from '../../forms';
import { CurrencyModule } from '../../modules/currency';
import { CountryModule } from '../../modules/country';
import { TimeZoneSelectorModule } from '../../modules/selectors';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		NgSelectModule,
		NbInputModule,
		NbDatepickerModule,
		ImageUploaderModule,
		NbSelectModule,
		NbToastrModule.forRoot(),
		NbListModule,
		NbStepperModule,
		NbToggleModule,
		NbSpinnerModule,
		RemoveLodashModule,
		NbTooltipModule,
		I18nTranslateModule.forChild(),
		TagsColorInputModule,
		CurrencyModule,
		CountryModule,
		LocationFormModule,
		LeafletMapModule,
		TimeZoneSelectorModule
	],
	declarations: [OrganizationsStepFormComponent],
	providers: [OrganizationDepartmentsService],
	exports: [OrganizationsStepFormComponent]
})
export class OrganizationsStepFormModule {}
