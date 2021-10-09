import { Routes, RouterModule } from '@angular/router';
import { NgModule } from '@angular/core';
import { AccountingTemplatesComponent } from './accounting-templates.component';
import { NgxPermissionsGuard } from 'ngx-permissions';
import { PermissionsEnum } from '@gauzy/contracts';

const routes: Routes = [
	{
		path: '',
		component: AccountingTemplatesComponent,
		canActivate: [NgxPermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.VIEW_ALL_ACCOUNTING_TEMPLATES],
				redirectTo: '/pages/settings'
			},
			selectors: {
				project: false,
				employee: false,
				date: false,
				organization: true
			}
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class AccountingTemplatesRoutingModule {}
