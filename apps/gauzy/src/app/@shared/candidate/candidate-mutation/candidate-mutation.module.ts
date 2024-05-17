import { FormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { NbCardModule, NbButtonModule, NbIconModule, NbStepperModule, NbTagModule } from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { ThemeModule } from '../../../@theme/theme.module';
import { UserFormsModule } from '../../user/forms/user-forms.module';
import { OrganizationsService } from '../../../@core/services/organizations.service';
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
		TranslateModule,
		NbStepperModule,
		NbTagModule
	],
	exports: [CandidateMutationComponent, CandidateCvComponent],
	declarations: [CandidateMutationComponent, CandidateCvComponent],
	providers: [OrganizationsService, RoleService]
})
export class CandidateMutationModule {}
