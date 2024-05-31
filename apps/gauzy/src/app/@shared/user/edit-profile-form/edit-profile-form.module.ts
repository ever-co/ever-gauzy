import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
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
import { OrganizationsService, UsersService } from '@gauzy/ui-sdk/core';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { ThemeModule } from '../../../@theme/theme.module';
import { EditProfileFormComponent } from './edit-profile-form.component';
import { UserFormsModule } from '../forms/user-forms.module';
import { RoleService } from '../../../@core/services';
import { ImageUploaderModule } from '../../image-uploader/image-uploader.module';
import { TagsColorInputModule } from '../../tags/tags-color-input/tags-color-input.module';
import { LanguageSelectorModule } from '../../language/language-selector';
import { SharedModule } from '../../shared.module';
import { PasswordFormFieldModule } from '../forms/fields/password';
import { RoleFormFieldModule } from '../forms/fields/role';
import { TableComponentsModule } from '../../table-components';
import { TimeZoneSelectorModule } from '../../selectors';
import { PhoneFormInputModule } from '../forms/fields';

@NgModule({
	imports: [
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
		ThemeModule,
		UserFormsModule,
		ImageUploaderModule,
		TranslateModule,
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
