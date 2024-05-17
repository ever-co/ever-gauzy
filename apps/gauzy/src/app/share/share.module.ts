import { NgModule } from '@angular/core';
import { NbMenuModule, NbToastrModule, NbSpinnerModule } from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { AuthService } from '../@core/services/auth.service';
import { RoleGuard } from '../@core/guards';
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
		TranslateModule,
		NbSpinnerModule
	],
	declarations: [ShareComponent],
	providers: [AuthService, RoleGuard]
})
export class ShareModule {}
