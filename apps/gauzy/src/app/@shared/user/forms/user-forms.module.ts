import { NgModule } from '@angular/core';
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
import { CountdownModule } from 'ngx-countdown';
import { NgSelectModule } from '@ng-select/ng-select';
import { ThemeModule } from '../../../@theme/theme.module';
import { FileUploaderModule } from '../../file-uploader-input/file-uploader-input.module';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { TagsColorInputModule } from '../../tags/tags-color-input/tags-color-input.module';
import { AuthService, CandidatesService, IncomeService, RoleService, TagsService } from '../../../@core/services';
import { SharedModule } from '../../shared.module';
import { COMPONENTS } from './index';
import { PasswordFormFieldModule } from './fields/password';
import { RoleFormFieldModule } from './fields/role';
import { NbIconModule } from '@nebular/theme';

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
		I18nTranslateModule.forChild(),
		CountdownModule,
		SharedModule,
		PasswordFormFieldModule,
		RoleFormFieldModule,
		NbIconModule
	],
	exports: [...COMPONENTS],
	declarations: [...COMPONENTS],
	providers: [AuthService, RoleService, IncomeService, TagsService, CandidatesService]
})
export class UserFormsModule {}
