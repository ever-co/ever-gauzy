import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RoleService } from '@gauzy/ui-core/core';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { EditProfileFormModule } from '@gauzy/ui-core/shared';
import { AuthRoutingModule } from './auth-routing.module';

@NgModule({
	imports: [CommonModule, I18nTranslateModule.forChild(), AuthRoutingModule, EditProfileFormModule],
	providers: [RoleService]
})
export class AuthModule {}
