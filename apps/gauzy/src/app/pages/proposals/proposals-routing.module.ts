import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { PermissionsGuard } from '@gauzy/ui-sdk/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { ProposalsComponent } from './proposals.component';
import { ProposalRegisterComponent } from './proposal-register/proposal-register.component';
import { ProposalDetailsComponent } from './proposal-details/proposal-details.component';
import { ProposalEditComponent } from './proposal-edit/proposal-edit.component';
import { DateRangePickerResolver } from '../../@theme/components/header/selectors/date-range-picker';
import { ProposalEditOrDetailsResolver } from './proposal-edit-or-details.resolver';

export function redirectTo() {
	return '/pages/dashboard';
}

const routes: Routes = [
	{
		path: '',
		component: ProposalsComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ORG_PROPOSALS_VIEW],
				redirectTo
			},
			selectors: {
				project: false
			},
			datePicker: {
				unitOfTime: 'month'
			}
		},
		resolve: {
			dates: DateRangePickerResolver
		}
	},
	{
		path: 'register',
		component: ProposalRegisterComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ORG_PROPOSALS_EDIT],
				redirectTo
			},
			selectors: {
				project: false,
				employee: false
			},
			datePicker: {
				unitOfTime: 'month'
			}
		},
		resolve: {
			dates: DateRangePickerResolver
		}
	},
	{
		path: 'details/:id',
		component: ProposalDetailsComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ORG_PROPOSALS_VIEW],
				redirectTo
			},
			selectors: {
				organization: false,
				date: false,
				employee: false,
				project: false
			}
		},
		resolve: {
			proposal: ProposalEditOrDetailsResolver
		}
	},
	{
		path: 'edit/:id',
		component: ProposalEditComponent,
		canActivate: [PermissionsGuard],
		data: {
			permissions: {
				only: [PermissionsEnum.ORG_PROPOSALS_EDIT],
				redirectTo
			},
			selectors: {
				organization: false,
				date: false,
				employee: false,
				project: false
			}
		},
		resolve: {
			proposal: ProposalEditOrDetailsResolver
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ProposalsRoutingModule {}
