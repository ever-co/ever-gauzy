import { Route } from '@angular/router';
import { NbAuthComponent } from '@nebular/auth';
import { PageRouteRegistryService } from '@gauzy/ui-core/core';
import { TermsAndConditionsComponent } from './components/terms-and-conditions/terms-and-conditions.component';
import { PrivacyPolicyComponent } from './components/privacy-policy/privacy-policy.component';

/**
 * Creates legal routes for the application
 *
 * @param _pageRouteRegistryService An instance of PageRouteRegistryService
 * @returns An array of Route objects
 */
export const createLegalRoutes = (_pageRouteRegistryService: PageRouteRegistryService): Route[] => [
	{
		path: '',
		component: NbAuthComponent,
		children: [
			{
				path: '',
				redirectTo: 'terms',
				pathMatch: 'full'
			},
			{
				path: 'terms',
				component: TermsAndConditionsComponent
			},
			{
				path: 'privacy',
				component: PrivacyPolicyComponent
			}
		]
	}
];
