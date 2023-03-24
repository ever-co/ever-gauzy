import { Routes, RouterModule } from '@angular/router';
import { NgModule } from '@angular/core';
import { NgxPermissionsGuard } from 'ngx-permissions';
import { PermissionsEnum } from '@gauzy/contracts';
import { TagsComponent } from './tags.component';

const routes: Routes = [
	{
		path: '',
		component: TagsComponent,
		canActivate: [NgxPermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TAGS_VIEW],
				redirectTo: '/pages/dashboard'
			}
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class TagsRoutingModule {}
