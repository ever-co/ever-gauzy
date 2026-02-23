import { ROUTES, RouterModule } from '@angular/router';
import { NgModule } from '@angular/core';
import { PageRouteRegistryService } from '@gauzy/ui-core/core';
import { getPagesRoutes } from './pages.routes';

@NgModule({
	imports: [RouterModule.forChild([])],
	exports: [RouterModule],
	providers: [
		{
			provide: ROUTES,
			useFactory: (pageRouteRegistryService: PageRouteRegistryService) =>
				getPagesRoutes(pageRouteRegistryService),
			deps: [PageRouteRegistryService],
			multi: true
		}
	]
})
export class PagesRoutingModule {}
