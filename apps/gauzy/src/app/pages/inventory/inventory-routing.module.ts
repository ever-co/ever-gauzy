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
				component: TableInventoryComponent
			},
			{
				path: 'create',
				component: ProductFormComponent
			},
			{
				path: 'edit/:id',
				component: ProductFormComponent
			},
			{
				path: 'view/:id',
				component: InventoryItemViewComponent
			},
			{
				path: ':itemId/variants/:itemVariantId',
				component: InventoryVariantFormComponent
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
			}
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class InventoryRoutingModule {}
