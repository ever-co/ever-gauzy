import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IntegrationSimLayoutComponent } from './integration-sim.layout.component';
import { SimAuthorizeComponent } from './components/sim-authorize/sim-authorize.component';
import { SimComponent } from './components/sim/sim.component';
import { SimExecutionsComponent } from './components/sim-executions/sim-executions.component';
import { SimWorkflowsComponent } from './components/sim-workflows/sim-workflows.component';
import { SimEventTriggersComponent } from './components/sim-event-triggers/sim-event-triggers.component';

@NgModule({
	imports: [
		RouterModule.forChild([
			{
				path: '',
				component: IntegrationSimLayoutComponent,
				children: [
					{
						path: '',
						component: SimAuthorizeComponent,
						data: { state: true }
					},
					{
						path: 'regenerate',
						component: SimAuthorizeComponent,
						data: { state: false }
					},
					{
						path: ':id',
						component: SimComponent,
						children: [
							{
								path: '',
								redirectTo: 'executions',
								pathMatch: 'full'
							},
							{
								path: 'executions',
								component: SimExecutionsComponent
							},
							{
								path: 'workflows',
								component: SimWorkflowsComponent
							},
							{
								path: 'event-triggers',
								component: SimEventTriggersComponent
							}
						]
					}
				]
			}
		])
	],
	exports: [RouterModule]
})
export class IntegrationSimRoutes {}
