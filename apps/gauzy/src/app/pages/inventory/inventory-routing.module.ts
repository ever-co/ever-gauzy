import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { InventoryComponent } from './components/inventory.component';
import { ProductTypesComponent } from './components/manage-product-types/product-types.component';
import { ProductCategoriesComponent } from './components/manage-product-categories/product-categories.component';
import { ProductFormComponent } from './components/edit-inventory-item/product-form.component';
import { TableInventoryComponent } from './components/table-inventory-items/table-inventory.component';
import { InventoryVariantFormComponent } from './components/edit-inventory-item-variant/variant-form.component';

const routes: Routes = [
	{
		path: '',
		component: InventoryComponent,
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
		component: ProductTypesComponent
	},
	{
		path: 'product-categories',
		component: ProductCategoriesComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class InventoryRoutingModule {}
