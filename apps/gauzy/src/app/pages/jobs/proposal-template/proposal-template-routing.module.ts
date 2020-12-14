import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { PermissionsEnum } from 'libs/models/src/lib/role-permission.model';
import { NgxPermissionsGuard } from 'ngx-permissions';
import { ProposalTemplateComponent } from './proposal-template/proposal-template.component';

const routes: Routes = [
	{
		path: '',
		component: ProposalTemplateComponent,
		canActivate: [NgxPermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ORG_PROPOSAL_TEMPLATES_VIEW],
				redirectTo: '/pages/jobs/search'
			}
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ProposalTemplateRoutingModule {}
