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

const ALL_ORG_PERMISSIONS = {
	permissions: {
		only: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ALL_ORG_EDIT],
		redirectTo: '/pages/dashboard'
	}
};

const routes: Routes = [
	{
		path: '',
		component: InventoryComponent,
		canActivate: [NgxPermissionsGuard],
		data: ALL_ORG_PERMISSIONS,
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
				path: ':itemId/variants/:itemVariantId',
				component: InventoryVariantFormComponent
			}
		]
	},
	{
		path: 'product-types',
		component: ProductTypesComponent,
		canActivate: [NgxPermissionsGuard],
		data: ALL_ORG_PERMISSIONS
	},
	{
		path: 'product-categories',
		component: ProductCategoriesComponent,
		canActivate: [NgxPermissionsGuard],
		data: ALL_ORG_PERMISSIONS
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class InventoryRoutingModule {}
