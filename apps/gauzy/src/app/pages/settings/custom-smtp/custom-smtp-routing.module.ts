import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { NgxPermissionsGuard } from 'ngx-permissions';
import { SMTPComponent } from '../../../@shared/smtp/smtp.component';
import { CustomSmtpComponent } from './custom-smtp.component';

const routes: Routes = [
	{
		path: '',
		component: CustomSmtpComponent,
		canActivate: [NgxPermissionsGuard],
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
						date: false
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
						date: false
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
