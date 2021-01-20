import { NgModule } from '@angular/core';
import { NbButtonModule, NbCardModule, NbIconModule } from '@nebular/theme';
import { TenantService } from '../../@core/services/tenant.service';
import { FeatureToggleModule } from '../../@shared/feature-toggle/feature-toggle.module';
import { TranslaterModule } from '../../@shared/translater/translater.module';
import { ThemeModule } from '../../@theme/theme.module';
import { OnboardingCompleteRoutingModule } from './onboarding-complete-routing.module';
import { OnboardingCompleteComponent } from './onboarding-complete.component';

@NgModule({
	imports: [
		OnboardingCompleteRoutingModule,
		ThemeModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		TranslaterModule,
		FeatureToggleModule
	],
	providers: [TenantService],
	declarations: [OnboardingCompleteComponent]
})
export class OnboardingCompleteModule {}
