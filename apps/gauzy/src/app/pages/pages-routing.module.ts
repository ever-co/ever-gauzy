import { ROUTES, RouterModule } from '@angular/router';
import { NgModule } from '@angular/core';
import { PageRouteRegistryService } from '@gauzy/ui-core/core';
import { createPagesRoutes } from './pages.routes';

@NgModule({
	imports: [RouterModule.forChild([])],
	exports: [RouterModule],
	providers: [
		{
			provide: ROUTES,
			useFactory: (service: PageRouteRegistryService) => createPagesRoutes(service),
			deps: [PageRouteRegistryService],
			multi: true
		}
	]
})
export class PagesRoutingModule {}
