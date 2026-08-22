import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { PermissionsGuard } from '@gauzy/ui-core/core';
import { BillingComponent } from './billing.component';

const routes: Routes = [
	{
		path: '',
		component: BillingComponent,
		// Guarded, not just hidden. The sidebar entry is behind TENANT_SETTING, but a menu permission
		// only decides what is rendered — anyone could still type /pages/settings/billing. The API
		// refuses regardless, so this was never a data leak, but the page should not open at all.
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.TENANT_SETTING],
				redirectTo: '/pages/settings'
			},
			// Billing is a tenant-wide concern, not scoped to an organization or a date range.
			selectors: false
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class BillingRoutingModule {}
