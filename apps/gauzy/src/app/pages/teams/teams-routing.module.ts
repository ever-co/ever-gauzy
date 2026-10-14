import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { PermissionsGuard } from '@gauzy/ui-core/core';
import { TeamsComponent } from './teams.component';
import { RecordViewRoutePageComponent } from '@gauzy/ui-core/shared';
import { TEAM_RECORD_VIEW } from './team-record-view';

const routes: Routes = [
	{
		path: '',
		component: TeamsComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TEAM_VIEW],
				redirectTo: '/pages/dashboard'
			}
		}
	},
	{
		// One record, full width, at a URL of its own: what its sidebar favorite opens (handover §4.P).
		path: 'view/:id',
		component: RecordViewRoutePageComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TEAM_VIEW],
				redirectTo: '/pages/organization/teams'
			},
			selectors: { project: false, team: false, employee: false, date: false },
			recordView: TEAM_RECORD_VIEW
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class TeamsRoutingModule {}
