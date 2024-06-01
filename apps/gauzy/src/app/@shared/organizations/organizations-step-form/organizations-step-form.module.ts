import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
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
	NbTooltipModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { ThemeModule } from '../../../@theme/theme.module';
import { OrganizationsStepFormComponent } from './organizations-step-form.component';
import { ImageUploaderModule } from '../../image-uploader/image-uploader.module';
import { OrganizationDepartmentsService } from '../../../@core/services/organization-departments.service';
import { RemoveLodashModule } from '../../remove-lodash/remove-lodash.module';
import { TagsColorInputModule } from '../../tags/tags-color-input/tags-color-input.module';
import { CurrencyModule } from '../../currency/currency.module';
import { CountryModule } from '../../country/country.module';
import { LocationFormModule } from '../../forms/location';
import { LeafletMapModule } from '../../forms/maps/leaflet/leaflet.module';
import { TimeZoneSelectorModule } from '../../selectors';

@NgModule({
	imports: [
		TagsColorInputModule,
		ThemeModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		NgSelectModule,
		ReactiveFormsModule,
		NbInputModule,
		FormsModule,
		NbDatepickerModule,
		ImageUploaderModule,
		NbSelectModule,
		NbToastrModule.forRoot(),
		NbListModule,
		NbStepperModule,
		NbToggleModule,
		RemoveLodashModule,
		NbTooltipModule,
		TranslateModule.forChild(),
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
