import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { PermissionsGuard } from '@gauzy/ui-core/core';
import { OAuthClientsComponent } from './oauth-clients.component';

const routes: Routes = [
	{
		path: '',
		component: OAuthClientsComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.OAUTH_CLIENT_VIEW],
				redirectTo: '/pages/settings'
			},
			selectors: {
				project: false,
				employee: false,
				date: false,
				organization: false
			}
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class OAuthClientsRoutingModule {}
