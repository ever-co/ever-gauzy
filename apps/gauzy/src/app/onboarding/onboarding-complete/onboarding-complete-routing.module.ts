import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { OnboardingCompleteComponent } from './onboarding-complete.component';
import { OrganizationsStepFormModule } from '../../@shared/organizations/organizations-step-form/organizations-step-form.module';

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
