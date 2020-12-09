import { HttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { NbLayoutModule, NbSpinnerModule } from '@nebular/theme';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { RoleGuard } from '../@core/role/role.guard';
import { AuthService } from '../@core/services/auth.service';
import { HttpLoaderFactory, ThemeModule } from '../@theme/theme.module';
import { OnboardingRoutingModule } from './onboarding-routing.module';
import { OnboardingComponent } from './onboarding.component';

@NgModule({
	imports: [
		OnboardingRoutingModule,
		ThemeModule,
		NbLayoutModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		NbSpinnerModule
	],
	entryComponents: [],
	declarations: [OnboardingComponent],
	providers: [AuthService, RoleGuard]
})
export class OnboardingModule {}
