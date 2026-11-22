import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { PermissionsGuard } from '@gauzy/ui-core/core';
import { VendorsComponent } from './vendors.component';
import { VendorViewPageComponent } from './vendor-view/vendor-view-page.component';

const routes: Routes = [
	{
		path: '',
		component: VendorsComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ALL_ORG_VIEW],
				redirectTo: '/pages/dashboard'
			}
		}
	},
	{
		// One record, full width, at a URL of its own: what its sidebar favorite opens (handover §4.P).
		path: 'view/:id',
		component: VendorViewPageComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: { only: [PermissionsEnum.ALL_ORG_VIEW], redirectTo: '/pages/organization/vendors' },
			selectors: { project: false, team: false, employee: false, date: false }
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class VendorsRoutingModule {}
