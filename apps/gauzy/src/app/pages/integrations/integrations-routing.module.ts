import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { NgxPermissionsGuard } from 'ngx-permissions';
import { PermissionsEnum } from '@gauzy/contracts';
import { IntegrationsListComponent } from './components/integrations-list/integrations-list.component';
import { WorkspaceComponent } from '../../@shared/components/workspace/workspace.component';

const routes: Routes = [
	{
		path: '',
		component: WorkspaceComponent,
		children: [
			{
				path: '',
				redirectTo: 'list',
				pathMatch: 'full'
			},
			{
				path: 'list',
				component: IntegrationsListComponent,
				canActivate: [NgxPermissionsGuard],
				data: {
					permissions: {
						only: [PermissionsEnum.INTEGRATION_VIEW],
						redirectTo: '/pages/dashboard'
					},
					selectors: {
						project: false,
						employee: false,
						organization: false,
						date: false
					}
				}
			},
			{
				path: 'upwork',
				loadChildren: () => import('../upwork/upwork.module').then(
					(m) => m.UpworkModule
				),
				data: {
					selectors: {
						project: false,
						employee: false,
						organization: false,
						date: false
					}
				}
			},
			{
				path: 'hubstaff',
				loadChildren: () => import('../hubstaff/hubstaff.module').then(
					(m) => m.HubstaffModule
				),
				data: {
					selectors: {
						project: false,
						employee: false,
						organization: false,
						date: false
					}
				}
			},
			{
				path: 'ever-ai',
				loadChildren: () => import('./gauzy-ai/gauzy-ai.module').then(
					(m) => m.GauzyAIModule
				),
				data: {
					selectors: {
						project: false,
						employee: false,
						organization: false,
						date: false
					}
				}
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class IntegrationsRoutingModule { }
