import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { userApiTokensEnabledGuard } from '@gauzy/ui-core/core';
import { ApiTokensComponent } from './api-tokens.component';

const routes: Routes = [
	{
		path: '',
		component: ApiTokensComponent,
		// No permission: a token carries only its user's own permissions, so the page is for anyone who can sign in.
		canActivate: [userApiTokensEnabledGuard],
		data: {
			selectors: {
				project: false,
				team: false,
				employee: false,
				date: false,
				organization: false
			}
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ApiTokensRoutingModule {}
