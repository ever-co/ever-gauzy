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
	NbToggleModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { OrganizationDepartmentsService } from '@gauzy/ui-sdk/core';
import { OrganizationsMutationComponent } from './organizations-mutation.component';
import { ImageUploaderModule } from '../../image-uploader/image-uploader.module';
import { RemoveLodashModule } from '../../remove-lodash/remove-lodash.module';
import { OrganizationsStepFormModule } from '../organizations-step-form/organizations-step-form.module';

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
		RemoveLodashModule,
		OrganizationsStepFormModule,
		I18nTranslateModule.forChild()
	],
	declarations: [OrganizationsMutationComponent],
	providers: [OrganizationDepartmentsService],
	exports: [OrganizationsMutationComponent]
})
export class OrganizationsMutationModule {}
