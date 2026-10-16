import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { PermissionsGuard } from '@gauzy/ui-core/core';
import { TeamsComponent } from './teams.component';
import { ViewTeamComponent } from './view-team/view-team.component';

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
		// The team's own page — overview, members and details — at a URL of its own:
		// what the list's View button and a sidebar favorite open (handover §4.P).
		path: 'view/:id',
		component: ViewTeamComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TEAM_VIEW],
				redirectTo: '/pages/organization/teams'
			},
			selectors: { project: false, team: false, employee: false, date: false }
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class TeamsRoutingModule {}
