import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import {
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbCheckboxModule,
	NbDatepickerModule,
	NbIconModule,
	NbInputModule,
	NbSelectModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService, CandidatesService, IncomeService, RoleService, TagsService } from '@gauzy/ui-core/core';
import { FileUploaderModule } from '../../file-uploader-input/file-uploader-input.module';
import { TagsColorInputModule } from '../../tags/tags-color-input/tags-color-input.module';
import { SharedModule } from '../../shared.module';
import { PasswordFormFieldModule, RoleFormFieldModule } from './fields';
import {
	ActionConfirmationComponent,
	ArchiveConfirmationComponent,
	BasicInfoFormComponent,
	CandidateActionConfirmationComponent,
	DeleteConfirmationComponent
} from './';

const COMPONENTS = [
	BasicInfoFormComponent,
	DeleteConfirmationComponent,
	ActionConfirmationComponent,
	ArchiveConfirmationComponent,
	CandidateActionConfirmationComponent
];

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbBadgeModule,
		NbButtonModule,
		NbCardModule,
		NbCheckboxModule,
		NbDatepickerModule,
		NbIconModule,
		NbInputModule,
		NbSelectModule,
		NgSelectModule,
		TranslateModule.forChild(),
		SharedModule,
		FileUploaderModule,
		TagsColorInputModule,
		PasswordFormFieldModule,
		RoleFormFieldModule
	],
	exports: [...COMPONENTS],
	declarations: [...COMPONENTS],
	providers: [AuthService, RoleService, IncomeService, TagsService, CandidatesService]
})
export class UserFormsModule {}
