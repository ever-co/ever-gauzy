import { NgModule } from '@angular/core';
import { RoleService } from '../../@core/services/role.service';
import { TranslateModule } from '../../@shared/translate/translate.module';
import { EditProfileFormModule } from '../../@shared/user/edit-profile-form/edit-profile-form.module';
import { ThemeModule } from '../../@theme/theme.module';
import { AuthRoutingModule } from './auth-routing.module';

@NgModule({
	imports: [
		AuthRoutingModule,
		ThemeModule,
		TranslateModule,
		EditProfileFormModule
	],
	providers: [RoleService]
})
export class AuthModule {}
