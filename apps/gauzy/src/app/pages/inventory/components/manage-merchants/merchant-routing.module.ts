import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MerchantComponent } from './merchant.component';
import { NgxPermissionsGuard } from 'ngx-permissions';
import { PermissionsEnum } from '@gauzy/contracts';
import { MerchantTableComponent } from './merchant-table/merchant-table.component';
import { MerchantFormComponent } from './merchant-form/merchant-form.component';
import { MerchantFormResolver } from './merchant-form/merchant-form.resolver';

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
				only: [
					...ORG_PERMISSIONS,
					PermissionsEnum.ORG_INVENTORY_VIEW
				],
				redirectTo: '/pages/dashboard'
			},
			selectors: {
				date: false,
				employee: false,
				project: false
			}
		},
		children: [
			{
				path: '',
				component: MerchantTableComponent
			},
			{
				path: 'create',
				component: MerchantFormComponent,
				data: {
					selectors: {
						organization: false,
						date: false,
						employee: false,
						project: false
					}
				}
			},
			{
				path: 'edit/:id',
				component: MerchantFormComponent,
				data: {
					selectors: {
						organization: false,
						date: false,
						employee: false,
						project: false
					}
				},
				resolve: {
					merchant: MerchantFormResolver
				}
			},
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class MerchantRoutingModule {}