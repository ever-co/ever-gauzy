import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';

const routes: Routes = [
	{
		path: '',
		redirectTo: 'date-specific-availability',
		pathMatch: 'full'
	},
	{
		path: '',
		component: LayoutComponent,
		children: [
			{
				path: 'date-specific-availability',
				loadChildren: () =>
					import(
						'./availability-slots/availability-slots.module'
					).then((m) => m.AvailabilitySlotsModule)
			}
		]
	},
	{
		path: '',
		component: LayoutComponent,
		children: [
			{
				path: 'recurring-availability',
				loadChildren: () =>
					import(
						'./availability-slots/availability-slots.module'
					).then((m) => m.AvailabilitySlotsModule)
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ScheduleRoutingModule {}
