import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { OrganizationsStepFormModule } from '@gauzy/ui-sdk/shared';
import { OnboardingCompleteComponent } from './onboarding-complete.component';

const routes: Routes = [
	{
		path: '',
		component: OnboardingCompleteComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes), OrganizationsStepFormModule],
	exports: [RouterModule]
})
export class OnboardingCompleteRoutingModule {}
