import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { PermissionsGuard } from '@gauzy/ui-core/core';
import { SMTPComponent } from '@gauzy/ui-core/shared';
import { CustomSmtpComponent } from './custom-smtp.component';

const routes: Routes = [
	{
		path: '',
		component: CustomSmtpComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.CUSTOM_SMTP_VIEW],
				redirectTo: '/pages/settings'
			}
		},
		children: [
			{
				path: '',
				redirectTo: 'tenant',
				pathMatch: 'full'
			},
			{
				path: 'tenant',
				component: SMTPComponent,
				data: {
					isOrganization: false,
					selectors: {
						project: false,
						employee: false,
						date: false,
						organization: false
					}
				}
			},
			{
				path: 'organization',
				component: SMTPComponent,
				data: {
					isOrganization: true,
					selectors: {
						project: false,
						employee: false,
						date: false,
						organization: true
					}
				}
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class CustomSmtpRoutingModule {}
