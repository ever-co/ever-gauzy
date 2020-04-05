import { HttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { NbButtonModule, NbCardModule, NbIconModule } from '@nebular/theme';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { TenantService } from '../../@core/services/tenant.service';
import { ThemeModule } from '../../@theme/theme.module';
import { OnboardingCompleteRoutingModule } from './onboarding-complete-routing.module';
import { OnboardingCompleteComponent } from './onboarding-complete.component';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, '../../assets/i18n/', '.json');
}

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
		})
	],
	providers: [TenantService],
	declarations: [OnboardingCompleteComponent]
})
export class OnboardingCompleteModule {}
