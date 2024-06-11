import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { OrganizationsStepFormModule } from '@gauzy/ui-sdk/shared';
import { TenantDetailsComponent } from './tenant-details.component';

const routes: Routes = [
	{
		path: '',
		component: TenantDetailsComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes), OrganizationsStepFormModule],
	exports: [RouterModule]
})
export class TenantDetailsRoutingModule {}
