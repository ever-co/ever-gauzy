import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NbAuthComponent } from '@nebular/auth';
import { PrivacyPolicyComponent, TermsAndConditionsComponent } from '@gauzy/ui-sdk/shared';

export const routes: Routes = [
	{
		path: 'legal',
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
export class LegalRoutingModule {}
