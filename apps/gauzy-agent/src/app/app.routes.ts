import { NgModule } from '@angular/core';
import { Route, ExtraOptions, RouterModule } from '@angular/router';
import { AboutComponent } from '@gauzy/desktop-ui-lib';

export const appRoutes: Route[] = [
	{
		path: 'about',
		component: AboutComponent
	}
];


/**
 * Configures the router for the application.
 */
const config: ExtraOptions = {
	useHash: true
};

@NgModule({
	imports: [RouterModule.forRoot(appRoutes, config)],
	exports: [RouterModule]
})
export class AppRoutingModule {}
