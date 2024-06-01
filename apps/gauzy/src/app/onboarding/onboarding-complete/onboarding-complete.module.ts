import { NgModule } from '@angular/core';
import { NbButtonModule, NbCardModule, NbIconModule } from '@nebular/theme';
import { TenantService } from '../../@core/services/tenant.service';
import { FeatureToggleModule } from '../../@shared/feature-toggle/feature-toggle.module';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { ThemeModule } from '../../@theme/theme.module';
import { OnboardingCompleteRoutingModule } from './onboarding-complete-routing.module';
import { OnboardingCompleteComponent } from './onboarding-complete.component';
import { ThemeSelectorModule } from '../../@theme/components/theme-sidebar/theme-settings/components/theme-selector/theme-selector.module';

@NgModule({
	imports: [
		OnboardingCompleteRoutingModule,
		ThemeModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		TranslateModule.forChild(),
		FeatureToggleModule,
		ThemeSelectorModule
	],
	providers: [TenantService],
	declarations: [OnboardingCompleteComponent]
})
export class OnboardingCompleteModule {}
