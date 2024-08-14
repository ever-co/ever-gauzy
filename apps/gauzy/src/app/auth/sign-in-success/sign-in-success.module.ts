import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ROUTES, RouterModule } from '@angular/router';
import { NbCardModule, NbSpinnerModule } from '@nebular/theme';
import { PageRouteService } from '@gauzy/ui-core/core';
import { SignInSuccessComponent } from './sign-in-success.component';
import { createRoutes } from './sign-in-success.routes';

@NgModule({
	imports: [CommonModule, RouterModule.forChild([]), NbCardModule, NbSpinnerModule],
	declarations: [SignInSuccessComponent],
	providers: [
		{
			provide: ROUTES,
			useFactory: (pageRouteService: PageRouteService) => createRoutes(pageRouteService),
			deps: [PageRouteService],
			multi: true
		}
	]
})
export class SignInSuccessModule {}
