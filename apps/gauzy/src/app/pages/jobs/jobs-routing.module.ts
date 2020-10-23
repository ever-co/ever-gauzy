import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { JobLayoutComponent } from './job-layout/job-layout.component';

const routes: Routes = [
	{
		path: '',
		component: JobLayoutComponent,
		children: [
			{
				path: '',
				redirectTo: 'search',
				pathMatch: 'full'
			},
			{
				path: 'search',
				loadChildren: () =>
					import('./search/search.module').then((m) => m.SearchModule)
			},
			{
				path: 'matching',
				loadChildren: () =>
					import('./matching/matching.module').then(
						(m) => m.MatchingModule
					)
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class JobsRoutingModule {}
