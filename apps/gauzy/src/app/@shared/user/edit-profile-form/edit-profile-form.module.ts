import { ThemeModule } from '../../../@theme/theme.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import {
	NbCardModule,
	NbButtonModule,
	NbIconModule,
	NbSelectModule,
	NbInputModule,
	NbBadgeModule
} from '@nebular/theme';
import { EditProfileFormComponent } from './edit-profile-form.component';
import { UserFormsModule } from '../forms/user-forms.module';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { UsersService } from '../../../@core/services';
import { ImageUploaderModule } from '../../image-uploader/image-uploader.module';
import { RoleService } from '../../../@core/services/role.service';
import { TagsColorInputModule } from '../../tags/tags-color-input/tags-color-input.module';
import { TranslateModule } from '../../translate/translate.module';

@NgModule({
	imports: [
		TagsColorInputModule,
		ThemeModule,
		FormsModule,
		NbCardModule,
		UserFormsModule,
		NbButtonModule,
		NbIconModule,
		ImageUploaderModule,
		NbSelectModule,
		ReactiveFormsModule,
		NbInputModule,
		NbBadgeModule,
		TranslateModule
	],
	exports: [EditProfileFormComponent],
	declarations: [EditProfileFormComponent],
	entryComponents: [EditProfileFormComponent],
	providers: [OrganizationsService, UsersService, RoleService]
})
export class EditProfileFormModule {}
