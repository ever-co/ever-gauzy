import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbLayoutModule, NbSpinnerModule } from '@nebular/theme';
import { AuthService, RoleGuard } from '@gauzy/ui-core/core';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { ThemeModule, ThemeSettingsModule } from '@gauzy/ui-core/theme';
import { OnboardingRoutingModule } from './onboarding-routing.module';
import { OnboardingComponent } from './onboarding.component';

@NgModule({
	imports: [
		CommonModule,
		NbLayoutModule,
		NbSpinnerModule,
		ThemeModule,
		I18nTranslateModule.forChild(),
		OnboardingRoutingModule,
		ThemeSettingsModule
	],
	declarations: [OnboardingComponent],
	providers: [AuthService, RoleGuard]
})
export class OnboardingModule {}
