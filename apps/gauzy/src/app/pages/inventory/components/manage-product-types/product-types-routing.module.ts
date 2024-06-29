import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PermissionsGuard } from '@gauzy/ui-core/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { ProductTypesComponent } from './product-types.component';

const routes: Routes = [
	{
		path: '',
		component: ProductTypesComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [
					PermissionsEnum.ALL_ORG_VIEW,
					PermissionsEnum.ALL_ORG_EDIT,
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
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ProductTypesRoutingModule {}
