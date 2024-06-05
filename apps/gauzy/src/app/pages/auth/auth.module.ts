import { NgModule } from '@angular/core';
import { RoleService } from '@gauzy/ui-sdk/core';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { EditProfileFormModule } from '../../@shared/user/edit-profile-form/edit-profile-form.module';
import { ThemeModule } from '../../@theme/theme.module';
import { AuthRoutingModule } from './auth-routing.module';

@NgModule({
	imports: [AuthRoutingModule, ThemeModule, I18nTranslateModule.forChild(), EditProfileFormModule],
	providers: [RoleService]
})
export class AuthModule {}
