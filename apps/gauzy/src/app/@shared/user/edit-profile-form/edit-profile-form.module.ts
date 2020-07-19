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
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { HttpClient } from '@angular/common/http';
import { UsersService } from '../../../@core/services';
import { ImageUploaderModule } from '../../image-uploader/image-uploader.module';
import { RoleService } from '../../../@core/services/role.service';
import { TagsColorInputModule } from '../../tags/tags-color-input/tags-color-input.module';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

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
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	exports: [EditProfileFormComponent],
	declarations: [EditProfileFormComponent],
	entryComponents: [EditProfileFormComponent],
	providers: [OrganizationsService, UsersService, RoleService]
})
export class EditProfileFormModule {}
