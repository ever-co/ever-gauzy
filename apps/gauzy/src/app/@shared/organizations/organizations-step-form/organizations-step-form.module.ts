import { ThemeModule } from '../../../@theme/theme.module';
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
import { OrganizationsStepFormComponent } from './organizations-step-form.component';
import { ImageUploaderModule } from '../../image-uploader/image-uploader.module';
import { OrganizationDepartmentsService } from '../../../@core/services/organization-departments.service';
import { RemoveLodashModule } from '../../remove-lodash/remove-lodash.module';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { CountryService } from '../../../@core/services/country.service';
import { TagsColorInputModule } from '../../tags/tags-color-input/tags-color-input.module';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

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
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	declarations: [OrganizationsStepFormComponent],
	entryComponents: [OrganizationsStepFormComponent],
	providers: [OrganizationDepartmentsService, CountryService],
	exports: [OrganizationsStepFormComponent]
})
export class OrganizationsStepFormModule {}
