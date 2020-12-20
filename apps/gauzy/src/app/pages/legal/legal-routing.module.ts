import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NbAuthComponent } from '@nebular/auth';
import { PrivacyPolicyComponent } from '../../@shared/legal/privacy-policy/privacy-policy.component';
import { TermsAndConditionsComponent } from '../../@shared/legal/terms-and-conditions/terms-and-conditions.component';

export const routes: Routes = [
	{
		path: '',
		component: NbAuthComponent,
		children: [
			{
				path: 'terms',
				component: TermsAndConditionsComponent
			},
			{
				path: 'privacy',
				component: PrivacyPolicyComponent
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class PageLegalRoutingModule {}
