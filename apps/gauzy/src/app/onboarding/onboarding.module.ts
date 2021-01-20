import { NgModule } from '@angular/core';
import { NbLayoutModule, NbSpinnerModule } from '@nebular/theme';
import { RoleGuard } from '../@core/role/role.guard';
import { AuthService } from '../@core/services/auth.service';
import { TranslaterModule } from '../@shared/translater/translater.module';
import { ThemeModule } from '../@theme/theme.module';
import { OnboardingRoutingModule } from './onboarding-routing.module';
import { OnboardingComponent } from './onboarding.component';

@NgModule({
	imports: [
		OnboardingRoutingModule,
		ThemeModule,
		NbLayoutModule,
		TranslaterModule,
		NbSpinnerModule
	],
	entryComponents: [],
	declarations: [OnboardingComponent],
	providers: [AuthService, RoleGuard]
})
export class OnboardingModule {}
