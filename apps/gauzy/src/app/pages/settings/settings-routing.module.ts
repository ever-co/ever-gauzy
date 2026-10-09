import { NgModule } from '@angular/core';
import { ROUTES, RouterModule } from '@angular/router';
import { PageRouteRegistryService } from '@gauzy/ui-core/core';
import { createSettingsRoutes } from './settings.routes';

/**
 * Settings routing.
 *
 * Routes are built by a factory so plugin-contributed settings pages registered
 * at the `settings-sections` location are spread into the settings shell's
 * children (see {@link createSettingsRoutes}) and therefore render with the
 * settings menu, exactly like the core settings pages.
 */
@NgModule({
	imports: [RouterModule.forChild([])],
	exports: [RouterModule],
	providers: [
		{
			provide: ROUTES,
			useFactory: (_pageRouteRegistryService: PageRouteRegistryService) =>
				createSettingsRoutes(_pageRouteRegistryService),
			deps: [PageRouteRegistryService],
			multi: true
		}
	]
})
export class SettingsRoutingModule {}
