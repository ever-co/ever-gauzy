import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';

const routes: Routes = [
	{
		path: '',
		redirectTo: 'screenshots',
		pathMatch: 'full'
	},
	{
		path: '',
		component: LayoutComponent,
		children: [
			{
				path: 'screenshots',
				data: {
					title: 'ACTIVITY.SCREENSHOTS'
				},
				loadChildren: () =>
					import('./screenshot/screenshot.module').then(
						(m) => m.ScreenshotModule
					)
			},
			{
				path: ':type',
				data: {
					title: 'ACTIVITY.APPS'
				},
				loadChildren: () =>
					import('./app-url-activity/app-url-activity.module').then(
						(m) => m.AppUrlActivityModule
					)
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ActivityRoutingModule {}
