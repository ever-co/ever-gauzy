import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NgxPermissionsGuard } from 'ngx-permissions';
import { PermissionsEnum } from '@gauzy/contracts';
import { WarehousesComponent } from './warehouses.component';
import { WarehouseFormComponent } from './warehouse-form/warehouse-form.component';
import { WarehousesTableComponent } from './warehouses-table/warehouses-table.component';

const ORG_PERMISSIONS = [
	PermissionsEnum.ALL_ORG_VIEW,
	PermissionsEnum.ALL_ORG_EDIT
];

const routes: Routes = [
	{
		path: '',
		component: WarehousesComponent,
		canActivate: [NgxPermissionsGuard],
		data: {
			permissions: {
				only: [
					...ORG_PERMISSIONS,
					PermissionsEnum.ORG_INVENTORY_VIEW
				],
				redirectTo: '/pages/dashboard'
			}
		},
		children: [
			{
				path: '',
				component: WarehousesTableComponent
			},
			{
				path: 'create',
				component: WarehouseFormComponent
			},
			{
				path: 'edit/:id',
				component: WarehouseFormComponent
			}
		]
	}
];


@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class WarehousesRoutingModule { }