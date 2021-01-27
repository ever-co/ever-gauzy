import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { PipelinesComponent } from './pipelines.component';
import { PipelineDealsComponent } from './pipeline-deals/pipeline-deals.component';
import { PipelineDealFormComponent } from './pipeline-deals/pipeline-deal-form/pipeline-deal-form.component';
import { NgxPermissionsGuard } from 'ngx-permissions';
import { PermissionsEnum } from '@gauzy/contracts';

export function redirectTo() {
	return '/pages/dashboard';
}

const PIPELINES_VIEW_PERMISSION = {
	permissions: {
		only: [
			PermissionsEnum.ALL_ORG_VIEW,
			PermissionsEnum.VIEW_SALES_PIPELINES
		],
		redirectTo
	}
};
@NgModule({
	imports: [
		RouterModule.forChild([
			{
				path: '',
				component: PipelinesComponent,
				canActivate: [NgxPermissionsGuard],
				data: PIPELINES_VIEW_PERMISSION
			},
			{
				path: ':pipelineId/deals',
				component: PipelineDealsComponent,
				canActivate: [NgxPermissionsGuard],
				data: PIPELINES_VIEW_PERMISSION
			},
			{
				path: ':pipelineId/deals/create',
				component: PipelineDealFormComponent,
				canActivate: [NgxPermissionsGuard],
				data: PIPELINES_VIEW_PERMISSION
			},
			{
				path: ':pipelineId/deals/:dealId/edit',
				component: PipelineDealFormComponent,
				canActivate: [NgxPermissionsGuard],
				data: PIPELINES_VIEW_PERMISSION
			}
		])
	],
	exports: [RouterModule]
})
export class PipelinesRouting {}
