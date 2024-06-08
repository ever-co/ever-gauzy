import { NgModule } from '@angular/core';
import { NbSelectModule } from '@nebular/theme';
import { ThemeModule } from '../../../@theme/theme.module';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { UserOrganizationsSelectComponent } from './user-organizations-multi-select.component';

@NgModule({
	imports: [ThemeModule, NbSelectModule, I18nTranslateModule.forChild()],
	declarations: [UserOrganizationsSelectComponent],
	exports: [UserOrganizationsSelectComponent],
	providers: []
})
export class UserOrganizationsMultiSelectModule {}
