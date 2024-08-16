import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ROUTES } from '@angular/router';
import { NbLayoutModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { PageRegistryService } from '@gauzy/ui-core/core';
import { createRoutes } from './server-down.routes';
import { ServerDownComponent } from './server-down.component';

@NgModule({
	imports: [CommonModule, FormsModule, RouterModule.forChild([]), NbLayoutModule, TranslateModule.forChild()],
	declarations: [ServerDownComponent],
	providers: [
		{
			provide: ROUTES,
			useFactory: (pageRouteService: PageRegistryService) => createRoutes(pageRouteService),
			deps: [PageRegistryService],
			multi: true
		}
	]
})
export class ServerDownModule {}
