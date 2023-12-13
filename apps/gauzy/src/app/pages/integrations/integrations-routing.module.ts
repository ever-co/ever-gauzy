import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { IntegrationLayoutComponent } from './layout/layout.component';
import { IntegrationsComponent } from './integrations.component';
import { IntegrationListComponent } from './components/integration-list/list.component';

const routes: Routes = [
	{
		path: '',
		component: IntegrationLayoutComponent,
		children: [
			{
				path: '',
				component: IntegrationListComponent,
				data: {
					selectors: {
						project: false,
						team: false,
						employee: false,
						date: false,
						organization: true
					}
				}
			},
			{
				path: 'new',
				component: IntegrationsComponent,
				data: {
					selectors: {
						project: false,
						team: false,
						employee: false,
						date: false,
						organization: false
					}
				}
			}
		]
	},
	/** Integrations List */
	{
		path: 'upwork',
		loadChildren: () => import('../upwork/upwork.module').then(
			(m) => m.UpworkModule
		)
	},
	{
		path: 'hubstaff',
		loadChildren: () => import('../hubstaff/hubstaff.module').then(
			(m) => m.HubstaffModule
		)
	},
	{
		path: 'gauzy-ai',
		loadChildren: () => import('./gauzy-ai/gauzy-ai.module').then(
			(m) => m.GauzyAIModule
		),
		data: {
			selectors: false
		}
	},
	{
		path: 'github',
		loadChildren: () => import('./github/github.module').then(
			(m) => m.GithubModule
		),
		data: {
			selectors: false
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class IntegrationsRoutingModule { }
