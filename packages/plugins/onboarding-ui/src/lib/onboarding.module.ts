import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ROUTES, RouterModule } from '@angular/router';
import { NbButtonModule, NbCardModule, NbIconModule, NbLayoutModule, NbSpinnerModule } from '@nebular/theme';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import {
	AuthService,
	FeatureStoreService,
	PageRouteRegistryService,
	RoleGuard,
	TenantService
} from '@gauzy/ui-core/core';
import { OrganizationsStepFormModule } from '@gauzy/ui-core/shared';
import { ThemeModule, ThemeSelectorModule, ThemeSettingsModule } from '@gauzy/ui-core/theme';
import { createOnboardingRoutes } from './onboarding.routes';
import { OnboardingComponent } from './components/onboarding.component';
import { TenantOnboardingComponent } from './components/tenant-onboarding/tenant-onboarding.component';
import { OnboardingCompleteComponent } from './components/onboarding-complete/onboarding-complete.component';
import { LanguagesEnum } from '@gauzy/contracts';
import { HttpLoaderFactory } from '@gauzy/ui-core/i18n';
import { HttpClient } from '@angular/common/http';
import { NgxPermissionsModule } from 'ngx-permissions';

// Nebular Modules
const NB_MODULES = [NbButtonModule, NbCardModule, NbIconModule, NbLayoutModule, NbSpinnerModule];

// Third Party Modules
const THIRD_PARTY_MODULES = [
	NgxPermissionsModule.forRoot(),
	TranslateModule.forRoot({
		defaultLanguage: LanguagesEnum.ENGLISH,
		loader: {
			provide: TranslateLoader,
			useFactory: HttpLoaderFactory,
			deps: [HttpClient]
		}
	})
];

@NgModule({
	imports: [
		CommonModule,
		RouterModule.forChild([]),
		...NB_MODULES,
		...THIRD_PARTY_MODULES,
		ThemeModule,
		ThemeSelectorModule,
		ThemeSettingsModule,
		OrganizationsStepFormModule
	],
	exports: [RouterModule],
	declarations: [OnboardingComponent, TenantOnboardingComponent, OnboardingCompleteComponent],
	providers: [
		AuthService,
		FeatureStoreService,
		TenantService,
		RoleGuard,
		{
			provide: ROUTES,
			useFactory: (service: PageRouteRegistryService) => createOnboardingRoutes(service),
			deps: [PageRouteRegistryService],
			multi: true
		}
	]
})
export class OnboardingModule {}
