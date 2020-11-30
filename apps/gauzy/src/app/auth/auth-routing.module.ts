import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NbAuthComponent } from '@nebular/auth';
import { NgxRegisterComponent } from './register/register.component';

export const routes: Routes = [
	{
		path: 'auth',
		component: NbAuthComponent,
		children: [
			{
				path: 'register',
				component: NgxRegisterComponent
			}
		]
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class NgxAuthRoutingModule {}
