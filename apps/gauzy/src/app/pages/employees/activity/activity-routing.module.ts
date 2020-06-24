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
				path: 'apps',
				data: {
					title: 'ACTIVITY.APPS'
				},
				loadChildren: () =>
					import('./app/app.module').then((m) => m.AppModule)
			},
			{
				path: 'urls',
				data: {
					title: 'ACTIVITY.URLS'
				},
				loadChildren: () =>
					import('./url/url.module').then((m) => m.UrlModule)
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ActivityRoutingModule {}
