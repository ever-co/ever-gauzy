import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { OrganizationsStepFormModule } from '@gauzy/ui-core/shared';
import { OnboardingResolver } from '@gauzy/ui-core/core';
import { TenantOnboardingComponent } from './tenant-onboarding.component';

const routes: Routes = [
	{
		path: '',
		component: TenantOnboardingComponent,
		resolve: {
			user: OnboardingResolver
		}
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes), OrganizationsStepFormModule],
	exports: [RouterModule]
})
export class TenantDetailsRoutingModule {}
