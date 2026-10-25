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
				component: PrivacyPolicyComponent,
				data: { documents: ['privacy'] }
			},
			{
				// The Cookie Policy is its own page. `PrivacyPolicyComponent` already renders the
				// cookie document from the bundled corpus, so the route reuses it and selects the
				// section through `data.documents` rather than duplicating the markup.
				path: 'cookies',
				component: PrivacyPolicyComponent,
				data: { documents: ['cookies'] }
			},
			{
				// The DPIA Support Pack is its own public compliance document, rendered by
				// `PrivacyPolicyComponent` selecting the 'dpia' document via `data.documents`.
				path: 'dpia',
				component: PrivacyPolicyComponent,
				data: { documents: ['dpia'] }
			}
		]
	}
];
