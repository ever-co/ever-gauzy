import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { PermissionsEnum } from '@gauzy/models';
import { NgxPermissionsGuard } from 'ngx-permissions';
import { ImportComponent } from './import.component';

const routes: Routes = [
	{
		path: '',
		component: ImportComponent,
		canActivate: [NgxPermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.IMPORT_EXPORT_VIEW],
				redirectTo: '/pages/settings'
			}
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ImportRoutingModule {}
