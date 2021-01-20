import { ArchiveConfirmationComponent } from './archive-confirmation/archive-confirmation.component';
import { ThemeModule } from '../../../@theme/theme.module';
import { NgModule } from '@angular/core';
import { BasicInfoFormComponent } from './basic-info/basic-info-form.component';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import {
	NbInputModule,
	NbCardModule,
	NbDatepickerModule,
	NbButtonModule,
	NbSelectModule,
	NbBadgeModule,
	NbCheckboxModule
} from '@nebular/theme';
import { AuthService } from '../../../@core/services/auth.service';
import { RoleService } from '../../../@core/services/role.service';
import { DeleteConfirmationComponent } from './delete-confirmation/delete-confirmation.component';
import { IncomeService } from '../../../@core/services/income.service';
import { ActionConfirmationComponent } from './action-confirmation/action-confirmation.component';
import { FileUploaderModule } from '../../file-uploader-input/file-uploader-input.module';
import { TagsService } from '../../../@core/services/tags.service';
import { NgSelectModule } from '@ng-select/ng-select';
import { TagsColorInputModule } from '../../tags/tags-color-input/tags-color-input.module';
import { CandidateActionConfirmationComponent } from './candidate-action-confirmation/candidate-action-confirmation.component';
import { TranslaterModule } from '../../translater/translater.module';

@NgModule({
	imports: [
		ThemeModule,
		FormsModule,
		ReactiveFormsModule,
		NbInputModule,
		NbCardModule,
		NbDatepickerModule,
		NbButtonModule,
		FileUploaderModule,
		NbSelectModule,
		NgSelectModule,
		NbBadgeModule,
		NbCheckboxModule,
		TagsColorInputModule,
		TranslaterModule
	],
	exports: [
		BasicInfoFormComponent,
		DeleteConfirmationComponent,
		ActionConfirmationComponent,
		ArchiveConfirmationComponent,
		CandidateActionConfirmationComponent
	],
	declarations: [
		BasicInfoFormComponent,
		DeleteConfirmationComponent,
		ActionConfirmationComponent,
		ArchiveConfirmationComponent,
		CandidateActionConfirmationComponent
	],
	entryComponents: [
		BasicInfoFormComponent,
		DeleteConfirmationComponent,
		ActionConfirmationComponent,
		ArchiveConfirmationComponent,
		CandidateActionConfirmationComponent
	],
	providers: [AuthService, RoleService, IncomeService, TagsService]
})
export class UserFormsModule {}
