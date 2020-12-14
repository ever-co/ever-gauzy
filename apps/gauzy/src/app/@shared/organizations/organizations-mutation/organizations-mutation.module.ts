import { HttpLoaderFactory, ThemeModule } from '../../../@theme/theme.module';
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
	NbToggleModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { OrganizationsMutationComponent } from './organizations-mutation.component';
import { ImageUploaderModule } from '../../image-uploader/image-uploader.module';
import { OrganizationDepartmentsService } from '../../../@core/services/organization-departments.service';
import { RemoveLodashModule } from '../../remove-lodash/remove-lodash.module';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { OrganizationsStepFormModule } from '../organizations-step-form/organizations-step-form.module';

@NgModule({
	imports: [
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
		OrganizationsStepFormModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	declarations: [OrganizationsMutationComponent],
	entryComponents: [OrganizationsMutationComponent],
	providers: [OrganizationDepartmentsService],
	exports: [OrganizationsMutationComponent]
})
export class OrganizationsMutationModule {}
