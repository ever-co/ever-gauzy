import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Route, ROUTES } from '@angular/router';
import { NbSidebarModule, NbLayoutModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { PageRouteService } from '@gauzy/ui-core/core';
import { createRoutes } from './server-down.routes';
import { ServerDownComponent } from './server-down.component';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		NbSidebarModule,
		NbLayoutModule,
		RouterModule.forChild([]),
		TranslateModule.forChild()
	],
	declarations: [ServerDownComponent],
	providers: [
		{
			provide: ROUTES,
			useFactory: (pageRouteService: PageRouteService) => createRoutes(pageRouteService),
			deps: [PageRouteService],
			multi: true
		}
	]
})
export class ServerDownModule {}
