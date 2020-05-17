import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';

const routes: Routes = [
	{
		path: '',
		redirectTo: 'date-specific-availibility',
		pathMatch: 'full'
	},
	{
		path: '',
		component: LayoutComponent,
		children: [
			{
				path: 'date-specific-availibility',
				loadChildren: () =>
					import(
						'./date-specific-availibility/date-specific-availibility.module'
					).then((m) => m.DateSpecificAvailibilityModule)
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ScheduleRoutingModule {}
