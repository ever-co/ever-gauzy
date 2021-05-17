import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { InventoryComponent } from './components/inventory.component';
import { ProductTypesComponent } from './components/manage-product-types/product-types.component';
import { ProductCategoriesComponent } from './components/manage-product-categories/product-categories.component';
import { ProductFormComponent } from './components/edit-inventory-item/product-form.component';
import { TableInventoryComponent } from './components/table-inventory-items/table-inventory.component';
import { InventoryVariantFormComponent } from './components/edit-inventory-item-variant/variant-form.component';
import { PermissionsEnum } from '@gauzy/contracts';
import { NgxPermissionsGuard } from 'ngx-permissions';
import { InventoryItemViewComponent } from './components/view-inventory-item/view-inventory-item.component';
import { WarehousesComponent } from './components/manage-warehouses/warehouses.component';
import { WarehouseFormComponent } from './components/manage-warehouses/warehouse-form/warehouse-form.component';
import { WarehousesTableComponent } from './components/manage-warehouses/warehouses-table/warehouses-table.component';
import { MerchantTableComponent } from './components/manage-merchants/merchant-table/merchant-table.component';
import { MerchantComponent } from './components/manage-merchants/merchant.component';
import { MerchantFormComponent } from './components/manage-merchants/merchant-form/merchant-form.component';

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
		component: ProductTypesComponent,
		canActivate: [NgxPermissionsGuard],
		data: {
			permissions: {
				only: [
					...ORG_PERMISSIONS,
					PermissionsEnum.ORG_PRODUCT_TYPES_VIEW
				],
				redirectTo: '/pages/dashboard'
			},
			selectors: {
				project: false,
				employee: false,
				date: false
			}
		}
	},
	{
		path: 'product-categories',
		component: ProductCategoriesComponent,
		canActivate: [NgxPermissionsGuard],
		data: {
			permissions: {
				only: [
					...ORG_PERMISSIONS,
					PermissionsEnum.ORG_PRODUCT_CATEGORIES_VIEW
				],
				redirectTo: '/pages/dashboard'
			},
			selectors: {
				project: false,
				employee: false,
				date: false
			}
		}
	},
	{
		path: 'warehouses',
		component: WarehousesComponent,
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
	},
	{
		path: 'merchants',
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
export class InventoryRoutingModule {}
