import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { PermissionsEnum } from '@gauzy/models';
import { NgxPermissionsGuard } from 'ngx-permissions';
import { EmployeeLevelComponent } from './employee-level.component';

const routes: Routes = [
	{
		path: '',
		component: EmployeeLevelComponent,
		canActivate: [NgxPermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ALL_ORG_VIEW],
				redirectTo: '/pages/dashboard'
			}
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class EmployeeLevelRoutingModule {}
