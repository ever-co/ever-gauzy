import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ContactType, PermissionsEnum } from '@gauzy/contracts';
import { PermissionsGuard } from '@gauzy/ui-sdk/core';
import { ContactsComponent } from './contacts.component';

const CONTACT_VIEW_PERMISSION = {
	permissions: {
		only: [PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_CONTACT_VIEW],
		redirectTo: '/pages/contacts/visitors'
	}
};

const routes: Routes = [
	{
		path: '',
		redirectTo: 'customers',
		pathMatch: 'full'
	},
	{
		path: 'visitors',
		loadChildren: () => import('./../work-in-progress/work-in-progress.module').then((m) => m.WorkInProgressModule),
		data: {
			selectors: {
				project: false,
				employee: false,
				date: false,
				organization: false
			}
		}
	},
	{
		path: 'clients',
		component: ContactsComponent,
		canActivate: [PermissionsGuard],
		data: {
			...CONTACT_VIEW_PERMISSION,
			selectors: {
				project: false,
				date: true
			},
			contactType: ContactType.CLIENT
		}
	},
	{
		path: 'customers',
		component: ContactsComponent,
		canActivate: [PermissionsGuard],
		data: {
			...CONTACT_VIEW_PERMISSION,
			selectors: {
				project: false,
				date: true
			},
			contactType: ContactType.CUSTOMER
		}
	},
	{
		path: 'leads',
		component: ContactsComponent,
		canActivate: [PermissionsGuard],
		data: {
			...CONTACT_VIEW_PERMISSION,
			selectors: {
				project: false,
				date: true
			},
			contactType: ContactType.LEAD
		}
	},
	{
		path: 'view/:id',
		loadChildren: () => import('./contact-view/contact-view.module').then((m) => m.ContactViewModule),
		data: {
			...CONTACT_VIEW_PERMISSION,
			selectors: {
				project: false,
				date: false
			}
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ContactsRoutingModule {}
