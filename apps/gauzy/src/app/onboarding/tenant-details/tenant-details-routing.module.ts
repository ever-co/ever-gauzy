import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { OrganizationsStepFormModule } from '../../@shared/organizations/organizations-step-form/organizations-step-form.module';
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
