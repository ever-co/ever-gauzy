import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbCardModule, NbIconModule } from '@nebular/theme';
import { TenantService } from '@gauzy/ui-core/core';
import { TranslateModule } from '@ngx-translate/core';
import { FeatureToggleModule } from '@gauzy/ui-core/shared';
import { ThemeModule, ThemeSelectorModule } from '@gauzy/ui-core/theme';
import { OnboardingCompleteRoutingModule } from './onboarding-complete-routing.module';
import { OnboardingCompleteComponent } from './onboarding-complete.component';

@NgModule({
	imports: [
		CommonModule,
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		TranslateModule.forChild(),
		ThemeModule,
		OnboardingCompleteRoutingModule,
		FeatureToggleModule,
		ThemeSelectorModule
	],
	providers: [TenantService],
	declarations: [OnboardingCompleteComponent]
})
export class OnboardingCompleteModule {}
