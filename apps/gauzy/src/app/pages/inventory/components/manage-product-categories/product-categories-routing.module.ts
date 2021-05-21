import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NgxPermissionsGuard } from 'ngx-permissions';
import { PermissionsEnum } from '@gauzy/contracts';
import { ProductCategoriesComponent } from './product-categories.component';

const ORG_PERMISSIONS = [
	PermissionsEnum.ALL_ORG_VIEW,
	PermissionsEnum.ALL_ORG_EDIT
];


const routes: Routes = [
	{
		path: '',
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
		},
		children: [
			{
				path: 'all',
				component: ProductCategoriesComponent
			}
		]
	}
];


@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ProductCategoriesRoutingModule { }