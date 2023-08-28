import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ISelectorVisibility } from '../../@core/services';
import { PrivacyPolicyComponent, TermsAndConditionsComponent } from '../../@shared/legal';

/**
 * Disabled header selectors for privacy/terms pages
 */
const selectors: ISelectorVisibility = {
	organization: false,
	date: false,
	employee: false,
	project: false,
	team: false
};

export const routes: Routes = [
	{
		path: '',
		children: [
			{
				path: 'terms',
				component: TermsAndConditionsComponent,
				data: {
					selectors
				}
			},
			{
				path: 'privacy',
				component: PrivacyPolicyComponent,
				data: {
					selectors
				}
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class PageLegalRoutingModule { }
