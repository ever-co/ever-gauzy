import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ActivityLayoutComponent } from './layout/layout.component';

const routes: Routes = [
	{
		path: '',
		component: ActivityLayoutComponent,
		children: [
			{
				path: '',
				redirectTo: 'time-activities',
				pathMatch: 'full'
			},
			{
				path: 'time-activities',
				loadChildren: () =>
					import('./time-and-activities/time-and-activities.module').then((m) => m.TimeAndActivitiesModule)
			},
			{
				path: 'screenshots',
				loadChildren: () => import('./screenshot/screenshot.module').then((m) => m.ScreenshotModule)
			},
			{
				path: '',
				loadChildren: () =>
					import('./app-url-activity/app-url-activity.module').then((m) => m.AppUrlActivityModule)
			},
			{
				path: '**', // Wildcard route for handling unknown paths
				redirectTo: 'time-activities' // Redirect to the default path
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ActivityRoutingModule {}
