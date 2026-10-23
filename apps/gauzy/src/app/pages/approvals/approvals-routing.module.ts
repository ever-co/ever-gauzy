import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { PermissionsGuard } from '@gauzy/ui-core/core';
import { ApprovalsComponent } from './approvals.component';
import { RecordViewRoutePageComponent } from '@gauzy/ui-core/shared';
import { APPROVAL_RECORD_VIEW } from './approval-record-view';

const routes: Routes = [
	{
		path: '',
		component: ApprovalsComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.REQUEST_APPROVAL_VIEW],
				redirectTo: '/pages/dashboard'
			}
		}
	},
	{
		// One record, full width, at a URL of its own: where the drawer's "expand to full width" icon leads.
		path: 'view/:id',
		component: RecordViewRoutePageComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: { only: [PermissionsEnum.REQUEST_APPROVAL_VIEW], redirectTo: '/pages/employees/approvals' },
			selectors: { project: false, team: false, employee: false, date: false },
			recordView: APPROVAL_RECORD_VIEW
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ApprovalsRoutingModule {}
