import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { GeneralSettingComponent } from './general-setting.component';

const routes: Routes = [
	{
		path: '',
		component: GeneralSettingComponent,
		data: {
			// Tenant-wide settings: none of the header selectors (organization, team, project,
			// employee, date range) apply here — same as the AI Providers settings page.
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
export class GeneralSettingRoutingModule {}
