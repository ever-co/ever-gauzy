import { Route } from '@angular/router';
import { OnboardingResolver, PageRouteRegistryService } from '@gauzy/ui-core/core';
import { OnboardingComponent } from './components/onboarding.component';
import { TenantOnboardingComponent } from './components/tenant-onboarding/tenant-onboarding.component';
import { OnboardingCompleteComponent } from './components/onboarding-complete/onboarding-complete.component';

/**
 * Creates onboarding routes for the application
 *
 * @param _pageRouteRegistryService An instance of PageRouteRegistryService
 * @returns An array of Route objects
 */
export const createOnboardingRoutes = (_pageRouteRegistryService: PageRouteRegistryService): Route[] => [
	{
		path: '',
		component: OnboardingComponent,
		children: [
			{
				path: 'tenant',
				component: TenantOnboardingComponent,
				resolve: { user: OnboardingResolver }
			},
			{
				path: 'complete',
				component: OnboardingCompleteComponent
			}
		]
	}
];
