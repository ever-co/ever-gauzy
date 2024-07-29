import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbLayoutModule, NbSpinnerModule } from '@nebular/theme';
import { AuthService, RoleGuard } from '@gauzy/ui-core/core';
import { TranslateModule } from '@ngx-translate/core';
import { ThemeModule, ThemeSettingsModule } from '@gauzy/ui-core/theme';
import { OnboardingRoutingModule } from './onboarding-routing.module';
import { OnboardingComponent } from './onboarding.component';

@NgModule({
	imports: [
		CommonModule,
		NbLayoutModule,
		NbSpinnerModule,
		ThemeModule,
		TranslateModule.forChild(),
		OnboardingRoutingModule,
		ThemeSettingsModule
	],
	declarations: [OnboardingComponent],
	providers: [AuthService, RoleGuard]
})
export class OnboardingModule {}
