import { Route } from '@angular/router';
import { PageRouteRegistryService } from '@gauzy/ui-core/core';
import { TermsAndConditionsComponent } from './components/terms-and-conditions/terms-and-conditions.component';
import { PrivacyPolicyComponent } from './components/privacy-policy/privacy-policy.component';

/**
 * Creates page legal routes for the application
 *
 * @param _pageRouteRegistryService An instance of PageRouteRegistryService
 * @returns An array of Route objects
 */
export const createPageLegalRoutes = (_pageRouteRegistryService: PageRouteRegistryService): Route[] => [
	{
		path: '',
		children: [
			{
				path: '',
				redirectTo: 'terms',
				pathMatch: 'full'
			},
			{
				path: 'terms',
				component: TermsAndConditionsComponent,
				data: {
					selectors: {
						organization: false,
						date: false,
						employee: false,
						project: false,
						team: false
					}
				}
			},
			{
				path: 'privacy',
				component: PrivacyPolicyComponent,
				data: {
					documents: ['privacy'],
					selectors: {
						organization: false,
						date: false,
						employee: false,
						project: false,
						team: false
					}
				}
			},
			{
				// Kept in step with the public `#/legal/*` mount in `legal.routes.ts`: the Cookie
				// Policy is a page of its own, rendered by `PrivacyPolicyComponent` with the
				// section picked through `data.documents`.
				path: 'cookies',
				component: PrivacyPolicyComponent,
				data: {
					documents: ['cookies'],
					selectors: {
						organization: false,
						date: false,
						employee: false,
						project: false,
						team: false
					}
				}
			}
		]
	}
];
