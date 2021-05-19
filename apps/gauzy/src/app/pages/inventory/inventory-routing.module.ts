import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { InventoryComponent } from './components/inventory.component';
import { ProductFormComponent } from './components/edit-inventory-item/product-form.component';
import { TableInventoryComponent } from './components/table-inventory-items/table-inventory.component';
import { InventoryVariantFormComponent } from './components/edit-inventory-item-variant/variant-form.component';
import { PermissionsEnum } from '@gauzy/contracts';
import { NgxPermissionsGuard } from 'ngx-permissions';
import { InventoryItemViewComponent } from './components/view-inventory-item/view-inventory-item.component';

const ORG_PERMISSIONS = [
	PermissionsEnum.ALL_ORG_VIEW,
	PermissionsEnum.ALL_ORG_EDIT
];

const routes: Routes = [
	{
		path: '',
		component: InventoryComponent,
		canActivate: [NgxPermissionsGuard],
		data: {
			permissions: {
				only: [...ORG_PERMISSIONS, PermissionsEnum.ORG_INVENTORY_VIEW],
				redirectTo: '/pages/dashboard'
			}
		},
		children: [
			{
				path: '',
				redirectTo: 'all',
				pathMatch: 'full'
			},
			{
				path: 'all',
				component: TableInventoryComponent,
				data: {
					selectors: {
						project: false,
						employee: false,
						date: false
					}
				}
			},
			{
				path: 'create',
				component: ProductFormComponent,
				data: {
					selectors: {
						project: false,
						employee: false,
						date: false
					}
				}
			},
			{
				path: 'edit/:id',
				component: ProductFormComponent,
				data: {
					selectors: {
						project: false,
						employee: false,
						date: false
					}
				}
			},
			{
				path: 'view/:id',
				component: InventoryItemViewComponent,
				data: {
					selectors: {
						project: false,
						employee: false,
						date: false
					}
				}
			},
			{
				path: ':itemId/variants/:itemVariantId',
				component: InventoryVariantFormComponent,
				data: {
					selectors: {
						project: false,
						employee: false,
						date: false
					}
				}
			}
		]
	},
	{
		path: 'product-types',
		loadChildren: () => import('./components/manage-product-types/product-types.module').then(m => m.ProductTypesModule)
	},
	{
		path: 'product-categories',
		loadChildren: () => import('./components/manage-product-categories/product-categories-routing.module').then(m => m.ProductCategoriesRoutingModule)
	},
	{
		path: 'warehouses',
		loadChildren: () => import('./components/manage-warehouses/warehouses.module').then(m => m.WarehousesModule)
	},
	{
		path: 'merchants',
		loadChildren: () => import('./components/manage-merchants/merchant.module').then(m => m.MerchantModule)
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class InventoryRoutingModule {}
