import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { PipelinesComponent } from './pipelines.component';
import { PipelineDealsComponent } from './pipeline-deals/pipeline-deals.component';
import { PipelineDealFormComponent } from './pipeline-deals/pipeline-deal-form/pipeline-deal-form.component';

@NgModule({
	imports: [
		RouterModule.forChild([
			{
				path: '',
				component: PipelinesComponent
			},
			{
				path: ':pipelineId/deals',
				component: PipelineDealsComponent
			},
			{
				path: ':pipelineId/deals/create',
				component: PipelineDealFormComponent
			},
			{
				path: ':pipelineId/deals/:dealId/edit',
				component: PipelineDealFormComponent
			}
		])
	],
	exports: [RouterModule]
})
export class PipelinesRouting {}
