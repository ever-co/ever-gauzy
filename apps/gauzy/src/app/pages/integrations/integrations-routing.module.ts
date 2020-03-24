import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { IntegrationsComponent } from './components/integrations/integrations.component';
import { UpworkComponent } from './components/upwork/upwork.component';

const routes: Routes = [
	{
		path: '',
		component: IntegrationsComponent,
		children: [
			{
				path: 'upwork',
				component: UpworkComponent
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class IntegrationsRoutingModule {}
