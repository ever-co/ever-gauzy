import { HttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { RoleService } from '../../@core/services/role.service';
import { EditProfileFormModule } from '../../@shared/user/edit-profile-form/edit-profile-form.module';
import { HttpLoaderFactory, ThemeModule } from '../../@theme/theme.module';
import { AuthRoutingModule } from './auth-routing.module';

@NgModule({
	imports: [
		AuthRoutingModule,
		ThemeModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		EditProfileFormModule
	],
	providers: [RoleService]
})
export class AuthModule {}
