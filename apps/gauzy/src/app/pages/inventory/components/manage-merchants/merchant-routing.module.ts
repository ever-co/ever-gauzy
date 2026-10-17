import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PermissionsGuard } from '@gauzy/ui-core/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { MerchantComponent } from './merchant.component';
import { MerchantTableComponent } from './merchant-table/merchant-table.component';
import { MerchantFormComponent } from './merchant-form/merchant-form.component';
import { MerchantFormResolver } from './merchant-form/merchant-form.resolver';
import { RecordViewRoutePageComponent } from '@gauzy/ui-core/shared';
import { MERCHANT_RECORD_VIEW } from './merchant-record-view';

const routes: Routes = [
	{
		path: '',
		component: MerchantComponent,
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
				component: MerchantTableComponent
			},
			{
				path: 'create',
				component: MerchantFormComponent,
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
				component: MerchantFormComponent,
				data: {
					selectors: {
						organization: false,
						date: false,
						employee: false,
						project: false
					}
				},
				resolve: {
					merchant: MerchantFormResolver
				}
			},
			{
				// One merchant, full width: where the merchants drawer's "expand to full width" icon leads.
				path: 'view/:id',
				component: RecordViewRoutePageComponent,
				data: {
					selectors: { organization: false, date: false, employee: false, project: false },
					recordView: MERCHANT_RECORD_VIEW
				}
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class MerchantRoutingModule {}
