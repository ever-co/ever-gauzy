import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbCardModule,
	NbButtonModule,
	NbIconModule,
	NbSelectModule,
	NbInputModule,
	NbBadgeModule,
	NbFormFieldModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
import { OrganizationsService, RoleService, UsersService } from '@gauzy/ui-core/core';
import { EditProfileFormComponent } from './edit-profile-form.component';
import { UserFormsModule } from '../forms/user-forms.module';
import { ImageUploaderModule } from '../../image-uploader/image-uploader.module';
import { TagsColorInputModule } from '../../tags/tags-color-input/tags-color-input.module';
import { LanguageSelectorModule } from '../../language/language-selector';
import { SharedModule } from '../../shared.module';
import { PasswordFormFieldModule, PhoneFormInputModule, RoleFormFieldModule } from '../forms/fields';
import { TableComponentsModule } from '../../table-components';
import { TimeZoneSelectorModule } from '../../modules/selectors';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbInputModule,
		NbSelectModule,
		NbBadgeModule,
		NbFormFieldModule,
		NgSelectModule,
		TagsColorInputModule,
		UserFormsModule,
		ImageUploaderModule,
		I18nTranslateModule.forChild(),
		LanguageSelectorModule,
		SharedModule,
		PasswordFormFieldModule,
		RoleFormFieldModule,
		TableComponentsModule,
		TimeZoneSelectorModule,
		PhoneFormInputModule
	],
	exports: [EditProfileFormComponent],
	declarations: [EditProfileFormComponent],
	providers: [OrganizationsService, UsersService, RoleService]
})
export class EditProfileFormModule {}
