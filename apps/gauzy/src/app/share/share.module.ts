import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbMenuModule, NbSpinnerModule, NbToastrModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { AuthService, RoleGuard } from '@gauzy/ui-core/core';
import { ThemeModule } from '@gauzy/ui-core/theme';
import { ShareComponent } from './share.component';
import { ShareRoutingModule } from './share-routing.module';
import { MiscellaneousModule } from '../pages/miscellaneous/miscellaneous.module';

@NgModule({
	imports: [
		CommonModule,
		NbMenuModule,
		NbSpinnerModule,
		NbToastrModule.forRoot(),
		I18nTranslateModule.forChild(),
		ShareRoutingModule,
		MiscellaneousModule,
		ThemeModule
	],
	declarations: [ShareComponent],
	providers: [AuthService, RoleGuard]
})
export class ShareModule {}
