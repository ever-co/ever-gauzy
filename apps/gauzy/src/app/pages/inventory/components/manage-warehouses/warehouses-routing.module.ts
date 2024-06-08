import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PermissionsGuard } from '@gauzy/ui-sdk/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { WarehousesComponent } from './warehouses.component';
import { WarehouseFormComponent } from './warehouse-form/warehouse-form.component';
import { WarehousesTableComponent } from './warehouses-table/warehouses-table.component';
import { WarehouseFormResolver } from './warehouse-form/warehouse-form.resolver';

const routes: Routes = [
	{
		path: '',
		component: WarehousesComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ORG_INVENTORY_VIEW],
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
				component: WarehousesTableComponent
			},
			{
				path: 'create',
				component: WarehouseFormComponent,
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
				component: WarehouseFormComponent,
				data: {
					selectors: {
						organization: false,
						date: false,
						employee: false,
						project: false
					}
				},
				resolve: {
					warehouse: WarehouseFormResolver
				}
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class WarehousesRoutingModule {}
