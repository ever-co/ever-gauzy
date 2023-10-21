import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { IntegrationsComponent } from './integrations.component';

const routes: Routes = [
	{
		path: 'new',
		component: IntegrationsComponent,
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
		)
	},
	{
		path: 'github',
		loadChildren: () => import('./github/github.module').then(
			(m) => m.GithubModule
		),
		data: {
			selectors: {
				project: true,
				team: true,
				employee: false,
				date: false,
				organization: false,
			}
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class IntegrationsRoutingModule { }
