import { RouterModule, Routes } from '@angular/router';
import { NgModule } from '@angular/core';
import { OnboardingComponent } from './onboarding.component';

const routes: Routes = [
	{
		path: '',
		component: OnboardingComponent,
		children: [
			{
				path: 'tenant',
				loadChildren: () =>
					import('./tenant-onboarding/tenant-onboarding.module').then((m) => m.TenantOnboardingModule)
			},
			{
				path: 'complete',
				loadChildren: () =>
					import('./onboarding-complete/onboarding-complete.module').then((m) => m.OnboardingCompleteModule)
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class OnboardingRoutingModule {}
