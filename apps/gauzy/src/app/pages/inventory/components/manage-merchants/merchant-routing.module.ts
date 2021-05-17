import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@nebular/auth/node_modules/@angular/router';
import { MerchantComponent } from './merchant.component';
import { NgxPermissionsGuard } from 'ngx-permissions';
import { PermissionsEnum } from '@gauzy/contracts';
import { MerchantTableComponent } from './merchant-table/merchant-table.component';
import { MerchantFormComponent } from './merchant-form/merchant-form.component';

const ORG_PERMISSIONS = [
	PermissionsEnum.ALL_ORG_VIEW,
	PermissionsEnum.ALL_ORG_EDIT
];
   

const routes: Routes = [
	{
        path: '',
		component: MerchantComponent,
		canActivate: [NgxPermissionsGuard], 
		data: {
			permissions: {
				only: [...ORG_PERMISSIONS, PermissionsEnum.ORG_INVENTORY_VIEW],
				redirectTo: '/pages/dashboard'
			}
		},
		children: [
			{
				path: 'all',
				component: MerchantTableComponent
			},
			{
				path: 'create',
				component: MerchantFormComponent
			},
			{
				path: 'edit/:id',
				component: MerchantFormComponent
			},
		]
	}
];


@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class MerchantRoutingModule {}