import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { EmployeeComponent } from './employee.component';
import { EmployeeResolver } from './employee.resolver';

const routes: Routes = [
	{
		path: '',
		component: EmployeeComponent,
		resolve: { employee: EmployeeResolver }
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class EmployeeRoutingModule {}
