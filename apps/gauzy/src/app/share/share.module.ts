import { NgModule } from '@angular/core';
import { NbMenuModule, NbToastrModule, NbSpinnerModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { AuthService, RoleGuard } from '@gauzy/ui-sdk/core';
import { ThemeModule } from '../@theme/theme.module';
import { ShareComponent } from './share.component';
import { ShareRoutingModule } from './share-routing.module';
import { MiscellaneousModule } from '../pages/miscellaneous/miscellaneous.module';

@NgModule({
	imports: [
		ShareRoutingModule,
		ThemeModule,
		NbMenuModule,
		MiscellaneousModule,
		NbToastrModule.forRoot(),
		I18nTranslateModule.forChild(),
		NbSpinnerModule
	],
	declarations: [ShareComponent],
	providers: [AuthService, RoleGuard]
})
export class ShareModule {}
