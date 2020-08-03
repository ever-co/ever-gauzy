import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { EmployeeLevelComponent } from './employee-level.component';

const routes: Routes = [
	{
		path: '',
		component: EmployeeLevelComponent
	}
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class EmployeeLevelRoutingModule {}
