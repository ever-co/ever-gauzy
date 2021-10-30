import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ContactViewComponent } from './contact-view.component';

const routes: Routes = [
	{
		path: '',
		component: ContactViewComponent,
		children: [
			{
				path: '',
				redirectTo: 'tenant',
				pathMatch: 'full'
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class ContactViewRoutingModule { }
