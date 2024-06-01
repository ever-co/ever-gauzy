import { FormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { NbCardModule, NbButtonModule, NbIconModule, NbStepperModule, NbTagModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { OrganizationsService } from '@gauzy/ui-sdk/core';
import { ThemeModule } from '../../../@theme/theme.module';
import { UserFormsModule } from '../../user/forms/user-forms.module';
import { RoleService } from '../../../@core/services/role.service';
import { CandidateMutationComponent } from './candidate-mutation.component';
import { CandidateCvComponent } from '../candidate-cv/candidate-cv.component';
import { FileUploaderModule } from '../../file-uploader-input/file-uploader-input.module';

@NgModule({
	imports: [
		ThemeModule,
		FormsModule,
		NbCardModule,
		UserFormsModule,
		NbButtonModule,
		NbIconModule,
		NbStepperModule,
		FileUploaderModule,
		I18nTranslateModule.forChild(),
		NbStepperModule,
		NbTagModule
	],
	exports: [CandidateMutationComponent, CandidateCvComponent],
	declarations: [CandidateMutationComponent, CandidateCvComponent],
	providers: [OrganizationsService, RoleService]
})
export class CandidateMutationModule {}
