import { NgModule } from '@angular/core';
import { RoleService } from '../../@core/services/role.service';
import { TranslaterModule } from '../../@shared/translater/translater.module';
import { EditProfileFormModule } from '../../@shared/user/edit-profile-form/edit-profile-form.module';
import { ThemeModule } from '../../@theme/theme.module';
import { AuthRoutingModule } from './auth-routing.module';

@NgModule({
	imports: [
		AuthRoutingModule,
		ThemeModule,
		TranslaterModule,
		EditProfileFormModule
	],
	providers: [RoleService]
})
export class AuthModule {}
