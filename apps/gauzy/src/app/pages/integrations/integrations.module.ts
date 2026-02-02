import { Inject, NgModule } from '@angular/core';
import { ROUTES, RouterModule } from '@angular/router';
import { PluginsModule } from '@gauzy/desktop-ui-lib';
import { PageRouteRegistryService } from '@gauzy/ui-core/core';
import { SharedModule, SmartDataViewLayoutModule, TableComponentsModule } from '@gauzy/ui-core/shared';
import {
	NbButtonGroupModule,
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule,
	NbTabsetModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { NgxPermissionsModule } from 'ngx-permissions';
import { IntegrationListComponent } from './components/integration-list/list.component';
import { IntegrationsComponent } from './integrations.component';
import { createIntegrationsRoutes } from './integrations.routes';
import { IntegrationLayoutComponent } from './layout/layout.component';
@NgModule({
	declarations: [IntegrationLayoutComponent, IntegrationListComponent, IntegrationsComponent],
	imports: [
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbInputModule,
		NbSelectModule,
		NbSpinnerModule,
		NbTooltipModule,
		NbTabsetModule,
		NbButtonGroupModule,
		RouterModule.forChild([]),
		NgxPermissionsModule.forChild(),
		TranslateModule.forChild(),
		SharedModule,
		SmartDataViewLayoutModule,
		TableComponentsModule,
		PluginsModule
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
			loadChildren: () => import('@gauzy/plugin-integration-upwork-ui').then((m) => m.IntegrationUpworkUiModule)
		});

		// Register the routes for hubstaff integration
		this._pageRouteRegistryService.registerPageRoute({
			// Data to be passed to the component
			data: { selectors: false },
			// Register the location 'integrations'
			location: 'integrations',
			// Register the path 'hubstaff'
			path: 'hubstaff',
			// Register the loadChildren function to load the HubstaffModule lazy module
			loadChildren: () => import('@gauzy/plugin-integration-hubstaff-ui').then((m) => m.IntegrationHubstaffModule)
		});

		// Register the routes for make.com integration
		this._pageRouteRegistryService.registerPageRoute({
			// Data to be passed to the component
			data: { selectors: false },
			// Register the location 'integrations'
			location: 'integrations',
			// Register the path 'makecom'
			path: 'makecom',
			// Register the loadChildren function to load the MakeComModule lazy module
			loadChildren: () =>
				import('@gauzy/plugin-integration-make-com-ui').then((m) => m.IntegrationMakeComUiModule)
		});

		// Register the routes for zapier integration
		this._pageRouteRegistryService.registerPageRoute({
			// Data to be passed to the component
			data: { selectors: false },
			// Register the location 'integrations'
			location: 'integrations',
			// Register the path 'zapier'
			path: 'zapier',
			// Register the loadChildren function to load the IntegrationZapierUiModule lazy module
			loadChildren: () => import('@gauzy/plugin-integration-zapier-ui').then((m) => m.IntegrationZapierUiModule)
		});

		// Register the routes for gauzy-ai integration
		this._pageRouteRegistryService.registerPageRoute({
			// Data to be passed to the component
			data: { selectors: false },
			// Register the location 'integrations'
			location: 'integrations',
			// Register the path 'gauzy-ai'
			path: 'gauzy-ai',
			// Register the loadChildren function to load the IntegrationAiUiModule lazy module
			loadChildren: () => import('@gauzy/plugin-integration-ai-ui').then((m) => m.IntegrationAiUiModule)
		});

		// Register the routes for github integration
		this._pageRouteRegistryService.registerPageRoute({
			// Data to be passed to the component
			data: { selectors: false },
			// Register the location 'integrations'
			location: 'integrations',
			// Register the path 'github'
			path: 'github',
			// Register the loadChildren function to load the GithubModule lazy module
			loadChildren: () => import('@gauzy/plugin-integration-github-ui').then((m) => m.IntegrationGithubUiModule)
		});

		// Register the routes for plugins
		this._pageRouteRegistryService.registerPageRoute({
			data: { selectors: false },
			location: 'integrations',
			path: 'plugins',
			loadChildren: () => import('@gauzy/desktop-ui-lib').then((m) => m.PluginRoutingModule)
		});

		// Register the routes for activepieces integration
		this._pageRouteRegistryService.registerPageRoute({
			// Data to be passed to the component
			data: { selectors: false },
			// Register the location 'integrations'
			location: 'integrations',
			// Register the path 'activepieces'
			path: 'activepieces',
			// Register the loadChildren function to load the IntegrationActivepiecesUiModule lazy module
			loadChildren: () =>
				import('@gauzy/plugin-integration-activepieces-ui').then((m) => m.IntegrationActivepiecesUiModule)
		});

		// Set hasRegisteredRoutes to true
		IntegrationsModule.hasRegisteredPageRoutes = true;
	}
}
