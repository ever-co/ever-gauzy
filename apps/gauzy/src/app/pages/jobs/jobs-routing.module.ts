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
			},
			{
				path: 'proposal-template',
				loadChildren: () =>
					import('./proposal-template/proposal-template.module').then(
						(m) => m.ProposalTemplateModule
					)
			},
			{
				path: 'employee',
				loadChildren: () =>
					import('./employees/employees.module').then(
						(m) => m.EmployeesModule
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
