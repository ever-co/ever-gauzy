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
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { ThemeModule } from '../../../@theme/theme.module';
import { OrganizationsMutationComponent } from './organizations-mutation.component';
import { ImageUploaderModule } from '../../image-uploader/image-uploader.module';
import { OrganizationDepartmentsService } from '@gauzy/ui-sdk/core';
import { RemoveLodashModule } from '../../remove-lodash/remove-lodash.module';
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
		I18nTranslateModule.forChild()
	],
	declarations: [OrganizationsMutationComponent],
	providers: [OrganizationDepartmentsService],
	exports: [OrganizationsMutationComponent]
})
export class OrganizationsMutationModule {}
