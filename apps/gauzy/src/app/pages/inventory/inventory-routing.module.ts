import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { InventoryComponent } from './inventory-table/inventory.component';
import { ProductTypesComponent } from './product-type/product-types.component';
import { ProductCategoriesComponent } from './product-category/product-categories.component';

const routes: Routes = [
	{
		path: '',
		component: InventoryComponent
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
