import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbButtonModule, NbCardModule, NbIconModule, NbStepperModule, NbTagModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { OrganizationsService, RoleService } from '@gauzy/ui-sdk/core';
import { UserFormsModule } from '../../user/forms/user-forms.module';
import { FileUploaderModule } from '../../file-uploader-input';
import { CandidateMutationComponent } from './candidate-mutation.component';
import { CandidateCvComponent } from '../candidate-cv/candidate-cv.component';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbStepperModule,
		NbTagModule,
		I18nTranslateModule.forChild(),
		UserFormsModule,
		FileUploaderModule
	],
	exports: [CandidateMutationComponent, CandidateCvComponent],
	declarations: [CandidateMutationComponent, CandidateCvComponent],
	providers: [OrganizationsService, RoleService]
})
export class CandidateMutationModule {}
