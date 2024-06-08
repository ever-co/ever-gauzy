import { Routes, RouterModule } from '@angular/router';
import { NgModule } from '@angular/core';
import { PermissionsGuard } from '@gauzy/ui-sdk/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { EmailTemplatesComponent } from './email-templates.component';

const routes: Routes = [
	{
		path: '',
		component: EmailTemplatesComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.VIEW_ALL_EMAIL_TEMPLATES],
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
export class EmailTemplatesRoutingModule {}
