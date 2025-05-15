import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthorizationComponent } from './components/make-com-authorize/make-com-authorize.component';
import { IntegrationMakeComLayoutComponent } from './integration-make-com.layout.component';

@NgModule({
	imports: [
		RouterModule.forChild([
			{
				path: '',
				component: IntegrationMakeComLayoutComponent,
				children: [
					{
						path: '',
						component: AuthorizationComponent,
						data: { state: true }
					},
					{
						path: 'regenerate',
						component: AuthorizationComponent,
						data: { state: false }
					},
					{
						path: 'authorize',
						component: AuthorizationComponent,
						data: { state: false }
					},
					{
						path: 'callback',
						component: AuthorizationComponent,
						data: { state: false }
					},
					{
						path: 'settings',
						loadChildren: () => import('@gauzy/ui-core/shared').then((m) => m.WorkInProgressModule)
					}
				]
			}
		])
	],
	exports: [RouterModule]
})
export class IntegrationMakeComRoutes {}
