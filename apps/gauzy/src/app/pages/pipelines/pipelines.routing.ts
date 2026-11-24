import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { PermissionsGuard } from '@gauzy/ui-core/core';
import { PipelinesComponent } from './pipelines.component';
import { PipelineDealsComponent } from './pipeline-deals/pipeline-deals.component';
import { PipelineDealFormComponent } from './pipeline-deals/pipeline-deal-form/pipeline-deal-form.component';
import { PipelineViewPageComponent } from './pipeline-view/pipeline-view-page.component';
import { PipelineResolver } from './routes/pipeline.resolver';
import { DealResolver } from './routes/deal.resolver';

const routes: Routes = [
	{
		path: '',
		component: PipelinesComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.VIEW_SALES_PIPELINES],
				redirectTo: '/pages/dashboard'
			}
		}
	},
	{
		// One pipeline, full width, at a URL of its own: its details and its stages with their deal counts.
		path: 'view/:id',
		component: PipelineViewPageComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.VIEW_SALES_PIPELINES],
				redirectTo: '/pages/sales/pipelines'
			}
		}
	},
	{
		path: ':pipelineId/deals',
		component: PipelineDealsComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.VIEW_SALES_PIPELINES],
				redirectTo: '/pages/dashboard'
			}
		},
		resolve: { pipeline: PipelineResolver }
	},
	{
		path: ':pipelineId/deals/create',
		component: PipelineDealFormComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.VIEW_SALES_PIPELINES],
				redirectTo: '/pages/dashboard'
			}
		},
		resolve: { pipeline: PipelineResolver }
	},
	{
		path: ':pipelineId/deals/:dealId/edit',
		component: PipelineDealFormComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.VIEW_SALES_PIPELINES],
				redirectTo: '/pages/dashboard'
			}
		},
		resolve: { pipeline: PipelineResolver, deal: DealResolver }
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class PipelinesRouting {}
