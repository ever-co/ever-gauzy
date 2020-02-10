import { HttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { RoleService } from '../../@core/services/role.service';
import { EditProfileFormModule } from '../../@shared/user/edit-profile-form/edit-profile-form.module';
import { ThemeModule } from '../../@theme/theme.module';
import { AuthRoutingModule } from './auth-routing.module';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

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
