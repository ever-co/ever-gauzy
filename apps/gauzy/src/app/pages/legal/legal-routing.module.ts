import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ISelectorVisibility } from '@gauzy/ui-core/core';
import { PrivacyPolicyComponent, TermsAndConditionsComponent } from '@gauzy/ui-core/shared';

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
					selectors // Disables header selectors for terms page
				}
			},
			{
				path: 'privacy',
				component: PrivacyPolicyComponent,
				data: {
					selectors // Disables header selectors for privacy page
				}
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class PageLegalRoutingModule {}
