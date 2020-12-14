import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { IntegrationsListComponent } from './components/integrations-list/integrations-list.component';
import { WorkspaceComponent } from '../../@shared/components/workspace/workspace.component';
import { NgxPermissionsGuard } from 'ngx-permissions';
import { PermissionsEnum } from '@gauzy/models';

const routes: Routes = [
	{
		path: '',
		component: WorkspaceComponent,
		canActivate: [NgxPermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.INTEGRATION_VIEW],
				redirectTo: '/pages/dashboard'
			}
		},
		children: [
			{
				path: '',
				redirectTo: 'list',
				pathMatch: 'full'
			},
			{
				path: 'list',
				component: IntegrationsListComponent
			},
			{
				path: 'upwork',
				loadChildren: () =>
					import('../upwork/upwork.module').then(
						(m) => m.UpworkModule
					)
			},
			{
				path: 'hubstaff',
				loadChildren: () =>
					import('../hubstaff/hubstaff.module').then(
						(m) => m.HubstaffModule
					)
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class IntegrationsRoutingModule {}
