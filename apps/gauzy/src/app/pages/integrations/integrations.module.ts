import { Inject, NgModule } from '@angular/core';
import { ROUTES, RouterModule } from '@angular/router';
import {
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTooltipModule
} from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateModule } from '@ngx-translate/core';
import { PageRouteRegistryService } from '@gauzy/ui-core/core';
import { SmartDataViewLayoutModule, SharedModule, TableComponentsModule } from '@gauzy/ui-core/shared';
import { createIntegrationsRoutes } from './integrations.routes';
import { IntegrationsComponent } from './integrations.component';
import { IntegrationLayoutComponent } from './layout/layout.component';
import { IntegrationListComponent } from './components/integration-list/list.component';

// Nebular Modules
const NB_MODULES = [
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTooltipModule
];

@NgModule({
	declarations: [IntegrationLayoutComponent, IntegrationListComponent, IntegrationsComponent],
	imports: [
		...NB_MODULES,
		RouterModule.forChild([]),
		NgxPermissionsModule.forChild(),
		TranslateModule.forChild(),
		SharedModule,
		SmartDataViewLayoutModule,
		TableComponentsModule
	],
	exports: [RouterModule],
	providers: [
		{
			provide: ROUTES,
			useFactory: (provider: PageRouteRegistryService) => createIntegrationsRoutes(provider),
			deps: [PageRouteRegistryService],
			multi: true
		}
	]
})
export class IntegrationsModule {
	private static hasRegisteredPageRoutes = false; // Flag to check if routes have been registered

	constructor(@Inject(PageRouteRegistryService) readonly _pageRouteRegistryService: PageRouteRegistryService) {
		// Register the routes
		this.registerPageRoutes();
	}

	/**
	 * Registers the routes for the integrations module.
	 * Ensures that the routes are only registered once.
	 *
	 * @returns
	 */
	registerPageRoutes(): void {
		if (IntegrationsModule.hasRegisteredPageRoutes) {
			return;
		}

		// Register the routes for upwork integration
		this._pageRouteRegistryService.registerPageRoute({
			// Register the location 'integrations'
			location: 'integrations',
			// Register the path 'upwork'
			path: 'upwork',
			// Register the loadChildren function to load the UpworkModule lazy module
			loadChildren: () => import('../upwork/upwork.module').then((m) => m.UpworkModule)
		});

		// Register the routes for hubstaff integration
		this._pageRouteRegistryService.registerPageRoute({
			// Register the location 'integrations'
			location: 'integrations',
			// Register the path 'hubstaff'
			path: 'hubstaff',
			// Register the loadChildren function to load the HubstaffModule lazy module
			loadChildren: () => import('../hubstaff/hubstaff.module').then((m) => m.HubstaffModule)
		});

		// Register the routes for gauzy-ai integration
		this._pageRouteRegistryService.registerPageRoute({
			// Register the location 'integrations'
			location: 'integrations',
			// Register the path 'gauzy-ai'
			path: 'gauzy-ai',
			// Register the loadChildren function to load the GauzyAIModule lazy module
			loadChildren: () => import('./gauzy-ai/gauzy-ai.module').then((m) => m.GauzyAIModule),
			data: { selectors: false }
		});

		// Register the routes for github integration
		this._pageRouteRegistryService.registerPageRoute({
			// Register the location 'integrations'
			location: 'integrations',
			// Register the path 'github'
			path: 'github',
			// Register the loadChildren function to load the GithubModule lazy module
			loadChildren: () => import('./github/github.module').then((m) => m.GithubModule),
			data: { selectors: false }
		});

		// Set hasRegisteredRoutes to true
		IntegrationsModule.hasRegisteredPageRoutes = true;
	}
}
