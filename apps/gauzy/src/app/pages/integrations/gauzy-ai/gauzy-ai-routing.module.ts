import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { GauzyAIAuthorizeComponent } from './gauzy-ai-authorize/gauzy-ai-authorize.component';

const routes: Routes = [
	{
		path: '',
		component: GauzyAIAuthorizeComponent,
		data: { state: true }
	},
	{
		path: ':id',
		component: GauzyAIAuthorizeComponent,
		data: { state: false }
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class GauzyAIRoutingModule { }
