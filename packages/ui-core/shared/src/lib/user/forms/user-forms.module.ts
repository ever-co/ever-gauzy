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
import { CountdownModule } from 'ngx-countdown';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
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
	CountdownConfirmationComponent,
	DeleteConfirmationComponent
} from './';

const COMPONENTS = [
	BasicInfoFormComponent,
	DeleteConfirmationComponent,
	ActionConfirmationComponent,
	ArchiveConfirmationComponent,
	CandidateActionConfirmationComponent,
	CountdownConfirmationComponent
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
		I18nTranslateModule.forChild(),
		SharedModule,
		FileUploaderModule,
		TagsColorInputModule,
		CountdownModule,
		PasswordFormFieldModule,
		RoleFormFieldModule
	],
	exports: [...COMPONENTS],
	declarations: [...COMPONENTS],
	providers: [AuthService, RoleService, IncomeService, TagsService, CandidatesService]
})
export class UserFormsModule {}
