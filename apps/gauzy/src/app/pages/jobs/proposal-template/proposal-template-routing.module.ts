import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ProposalTemplateComponent } from './proposal-template/proposal-template.component';

const routes: Routes = [
	{
		path: '',
		component: ProposalTemplateComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ProposalTemplateRoutingModule {}
