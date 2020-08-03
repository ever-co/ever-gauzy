import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { EmploymentTypesComponent } from './employment-types.component';

const routes: Routes = [
	{
		path: '',
		component: EmploymentTypesComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class EmploymentTypesRoutingModule {}
