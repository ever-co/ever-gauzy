import { HttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { NbButtonModule, NbCardModule, NbIconModule } from '@nebular/theme';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TenantService } from '../../@core/services/tenant.service';
import { FeatureToggleModule } from '../../@shared/feature-toggle/feature-toggle.module';
import { HttpLoaderFactory, ThemeModule } from '../../@theme/theme.module';
import { OnboardingCompleteRoutingModule } from './onboarding-complete-routing.module';
import { OnboardingCompleteComponent } from './onboarding-complete.component';

@NgModule({
	imports: [
		OnboardingCompleteRoutingModule,
		ThemeModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		FeatureToggleModule
	],
	providers: [TenantService],
	declarations: [OnboardingCompleteComponent]
})
export class OnboardingCompleteModule {}
