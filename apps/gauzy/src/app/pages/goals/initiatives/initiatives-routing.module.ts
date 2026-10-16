import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { PermissionsGuard } from '@gauzy/ui-core/core';
import { InitiativesComponent } from './initiatives.component';
import { InitiativeDetailComponent } from './initiative-detail/initiative-detail.component';

const canRead = {
	permissions: {
		only: [PermissionsEnum.ORG_STRATEGIC_INITIATIVE_READ],
		redirectTo: '/pages/dashboard'
	}
};

const routes: Routes = [
	{
		path: '',
		component: InitiativesComponent,
		canActivate: [PermissionsGuard],
		data: canRead
	},
	{
		path: ':id',
		component: InitiativeDetailComponent,
		canActivate: [PermissionsGuard],
		data: canRead
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class InitiativesRoutingModule {}
