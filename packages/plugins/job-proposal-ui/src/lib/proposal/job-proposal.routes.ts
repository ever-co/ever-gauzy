import { Route } from '@angular/router';
import { PageRouteRegistryService } from '@gauzy/ui-core/core';
import { ProposalLayoutComponent } from './components/proposal-layout.component';

/**
 * Creates proposal routes for the application
 *
 * @param _pageRouteRegistryService An instance of PageRouteRegistryService
 * @returns An array of Route objects
 */
export const createProposalsRoutes = (_pageRouteRegistryService: PageRouteRegistryService): Route[] => [
	{
		path: '',
		component: ProposalLayoutComponent,
		children: _pageRouteRegistryService.getPageLocationRoutes('proposals')
	}
];
