import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { NgxPermissionsGuard } from 'ngx-permissions';
import { ExportComponent } from './export.component';

const routes: Routes = [
	{
		path: '',
		component: ExportComponent,
		canActivate: [NgxPermissionsGuard],
		data: {
			permissions: {
				only: [
					PermissionsEnum.ALL_ORG_VIEW,
					PermissionsEnum.EXPORT_ADD
				],
				redirectTo: '/pages/settings'
			}
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ExportRoutingModule { }
