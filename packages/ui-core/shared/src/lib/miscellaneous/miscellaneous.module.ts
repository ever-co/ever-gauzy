import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ROUTES, RouterModule } from '@angular/router';
import { NbButtonModule, NbCardModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { PageRouteRegistryService } from '@gauzy/ui-core/core';
import { createRoutes } from './miscellaneous.routes';
import { MiscellaneousComponent } from './miscellaneous.component';
import { NotFoundComponent } from './components/not-found/not-found.component';

const NB_MODULES = [NbCardModule, NbButtonModule];

@NgModule({
	imports: [CommonModule, RouterModule.forChild([]), ...NB_MODULES, TranslateModule.forChild()],
	declarations: [MiscellaneousComponent, NotFoundComponent],
	exports: [MiscellaneousComponent, NotFoundComponent],
	providers: [
		{
			provide: ROUTES,
			useFactory: (service: PageRouteRegistryService) => createRoutes(service),
			deps: [PageRouteRegistryService],
			multi: true
		}
	]
})
export class MiscellaneousModule {}
