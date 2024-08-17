import { NgModule } from '@angular/core';
import { ROUTES } from '@angular/router';
import { PageRouteRegistryService } from '@gauzy/ui-core/core';
import { createLegalRoutes } from './legal.routes';
import { CommonLegalModule } from './common-legal.module';

@NgModule({
	imports: [CommonLegalModule],
	providers: [
		{
			provide: ROUTES,
			useFactory: (service: PageRouteRegistryService) => createLegalRoutes(service),
			deps: [PageRouteRegistryService],
			multi: true
		}
	]
})
export class LegalModule {}
