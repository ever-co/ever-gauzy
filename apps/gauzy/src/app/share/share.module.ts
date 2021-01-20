import { NgModule } from '@angular/core';
import { NbMenuModule, NbToastrModule, NbSpinnerModule } from '@nebular/theme';
import { ThemeModule } from '../@theme/theme.module';
import { ShareComponent } from './share.component';
import { ShareRoutingModule } from './share-routing.module';
import { MiscellaneousModule } from '../pages/miscellaneous/miscellaneous.module';
import { AuthService } from '../@core/services/auth.service';
import { RoleGuard } from '../@core/role/role.guard';
import { TranslaterModule } from '../@shared/translater/translater.module';

@NgModule({
	imports: [
		ShareRoutingModule,
		ThemeModule,
		NbMenuModule,
		MiscellaneousModule,
		NbToastrModule.forRoot(),
		TranslaterModule,
		NbSpinnerModule
	],
	entryComponents: [],
	declarations: [ShareComponent],
	providers: [AuthService, RoleGuard]
})
export class ShareModule {}
