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
					import('./tenant-details/tenant-details.module').then(
						(m) => m.TenantDetailsModule
					)
			},
			{
				path: 'complete',
				loadChildren: () =>
					import(
						'./onboarding-complete/onboarding-complete.module'
					).then((m) => m.OnboardingCompleteModule)
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class OnboardingRoutingModule {}
